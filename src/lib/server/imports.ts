/**
 * Subscribed calendars (config.yml → subscriptions): fetched every 30 minutes, expanded with
 * ical.js (which handles RRULE, EXDATE and moved occurrences), and kept in the database so the
 * calendar shows them even when the source can't be reached.
 */
import { and, eq, gte, inArray, lte, notInArray } from 'drizzle-orm';
import ICAL from 'ical.js';
import { addDays } from '../dates.ts';
import type { ImportStatus } from '../types.ts';
import { dateInZone, isTimeZone, zonedToInstant } from '../zone.ts';
import type { Subscription } from './config.ts';
import type { Db } from './db/client.ts';
import { imported, importStatus } from './db/schema.ts';
import { log } from './log.ts';

/** One occurrence from a subscribed calendar. */
export interface ImportedOccurrence {
	readonly uid: string;
	readonly title: string;
	readonly location: string | null;
	readonly notes: string | null;
	readonly allDay: boolean;
	/** All-day: first day. Timed: ISO instant (UTC). */
	readonly start: string;
	/** All-day: last day (included). Timed: ISO instant (UTC). */
	readonly end: string;
	readonly firstDay: string;
	readonly lastDay: string;
}

/** How far back and ahead imported calendars are expanded. */
export const IMPORT_WINDOW = { pastDays: 183, futureDays: 548 };
/** A runaway rule (every minute for years) stops here. */
const MAX_STEPS = 50_000;
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

const pad = (value: number) => String(value).padStart(2, '0');

function dateOf(time: ICAL.Time): string {
	return `${String(time.year).padStart(4, '0')}-${pad(time.month)}-${pad(time.day)}`;
}

/** The real instant of an ICAL.Time, trusting the IANA zone database over the feed's own. */
function instantOf(time: ICAL.Time, fallbackZone: string): number {
	const zone = time.zone;
	if (zone === ICAL.Timezone.utcTimezone) {
		return Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second);
	}
	const tzid = zone?.tzid;
	const clock = `${pad(time.hour)}:${pad(time.minute)}`;
	if (tzid && tzid !== 'floating' && isTimeZone(tzid)) {
		return zonedToInstant(dateOf(time), clock, tzid) + time.second * 1000;
	}
	if (zone && zone.tzid !== 'floating' && zone !== ICAL.Timezone.localTimezone) {
		return time.toUnixTime() * 1000;
	}
	return zonedToInstant(dateOf(time), clock, fallbackZone) + time.second * 1000;
}

function text(component: ICAL.Component, name: string): string | null {
	const value = component.getFirstPropertyValue(name);
	if (value === null || value === undefined) return null;
	const trimmed = String(value).trim();
	return trimmed === '' ? null : trimmed.slice(0, 4000);
}

/**
 * Every occurrence in an iCalendar text that touches the days `from`…`to`, with dates seen in
 * `timeZone` (also the zone for floating times).
 */
export function parseIcs(
	source: string,
	options: { from: string; to: string; timeZone: string }
): ImportedOccurrence[] {
	const calendar = new ICAL.Component(ICAL.parse(source));
	for (const vtimezone of calendar.getAllSubcomponents('vtimezone')) {
		const tzid = vtimezone.getFirstPropertyValue('tzid');
		if (typeof tzid === 'string' && !ICAL.TimezoneService.has(tzid)) {
			ICAL.TimezoneService.register(vtimezone);
		}
	}

	const vevents = calendar.getAllSubcomponents('vevent');
	const masters = new Map<string, ICAL.Event>();
	const exceptions: ICAL.Event[] = [];
	for (const vevent of vevents) {
		const event = new ICAL.Event(vevent);
		if (!event.uid || !event.startDate) continue;
		if (event.isRecurrenceException()) exceptions.push(event);
		else masters.set(event.uid, event);
	}
	for (const exception of exceptions) {
		const master = masters.get(exception.uid);
		if (master) master.relateException(exception);
		else masters.set(`${exception.uid}#${exception.recurrenceId}`, exception);
	}

	const windowStart = zonedToInstant(options.from, '00:00', options.timeZone);
	const windowEnd = zonedToInstant(addDays(options.to, 1), '00:00', options.timeZone);
	const results: ImportedOccurrence[] = [];

	const add = (item: ICAL.Event, startTime: ICAL.Time, endTime: ICAL.Time | null) => {
		if (String(item.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED')
			return;
		const base = {
			uid: item.uid,
			title: item.summary?.trim() || '(No title)',
			location: text(item.component, 'location'),
			notes: text(item.component, 'description')
		};
		if (startTime.isDate) {
			const first = dateOf(startTime);
			const after = endTime && endTime.isDate ? dateOf(endTime) : addDays(first, 1);
			const last = after > first ? addDays(after, -1) : first;
			if (last < options.from || first > options.to) return;
			results.push({
				...base,
				allDay: true,
				start: first,
				end: last,
				firstDay: first,
				lastDay: last
			});
			return;
		}
		const start = instantOf(startTime, options.timeZone);
		const end = Math.max(start, endTime ? instantOf(endTime, options.timeZone) : start);
		if (start >= windowEnd || (end <= windowStart && !(end === start && start >= windowStart)))
			return;
		results.push({
			...base,
			allDay: false,
			start: new Date(start).toISOString(),
			end: new Date(end).toISOString(),
			firstDay: dateInZone(start, options.timeZone),
			lastDay: dateInZone(end > start ? end - 1 : end, options.timeZone)
		});
	};

	for (const event of masters.values()) {
		if (!event.isRecurring()) {
			add(event, event.startDate, event.endDate);
			continue;
		}
		const iterator = event.iterator();
		for (
			let step = 0, next = iterator.next();
			next && step < MAX_STEPS;
			step++, next = iterator.next()
		) {
			const details = event.getOccurrenceDetails(next);
			if (instantOrDate(details.startDate, options.timeZone) >= windowEnd) break;
			add(details.item, details.startDate, details.endDate);
		}
	}
	return results.sort(
		(a, b) => a.firstDay.localeCompare(b.firstDay) || a.start.localeCompare(b.start)
	);
}

function instantOrDate(time: ICAL.Time, timeZone: string): number {
	return time.isDate ? zonedToInstant(dateOf(time), '00:00', timeZone) : instantOf(time, timeZone);
}

/** Downloads a calendar, giving up after a timeout or at an unreasonable size. */
export async function download(url: string, fetcher: typeof fetch = fetch): Promise<string> {
	const response = await fetcher(url, {
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: { accept: 'text/calendar, */*;q=0.5', 'user-agent': 'NiijimaCalendar/1.0' },
		redirect: 'follow'
	});
	if (!response.ok) throw new Error(`the server answered ${response.status}`);
	const length = Number(response.headers.get('content-length') ?? 0);
	if (length > MAX_BYTES) throw new Error('the calendar is larger than 10 MB');
	const body = await response.text();
	if (body.length > MAX_BYTES) throw new Error('the calendar is larger than 10 MB');
	if (!body.includes('BEGIN:VCALENDAR')) throw new Error('the address did not return a calendar');
	return body;
}

function describe(error: unknown): string {
	if (error instanceof Error) {
		if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'timed out';
		const cause = (error as { cause?: { code?: string; message?: string } }).cause;
		return cause?.code ?? cause?.message ?? error.message;
	}
	return String(error);
}

export interface ImportServiceOptions {
	readonly db: Db;
	readonly subscriptions: readonly Subscription[];
	readonly timeZone: string;
	readonly fetcher?: typeof fetch;
	readonly now?: () => number;
}

/** Fetches the subscribed calendars and keeps their occurrences in the database. */
export class ImportService {
	readonly #options: ImportServiceOptions;
	#running: Promise<void> | null = null;

	constructor(options: ImportServiceOptions) {
		this.#options = options;
		const names = options.subscriptions.map((s) => s.name);
		// Forget calendars that were removed from config.yml.
		const stale = names.length > 0 ? notInArray(imported.source, names) : undefined;
		options.db.delete(imported).where(stale).run();
		options.db
			.delete(importStatus)
			.where(names.length > 0 ? notInArray(importStatus.source, names) : undefined)
			.run();
	}

	get subscriptions(): readonly Subscription[] {
		return this.#options.subscriptions;
	}

	/** Fetches every subscription; never throws. Concurrent calls share one run. */
	refreshAll(): Promise<void> {
		this.#running ??= (async () => {
			try {
				for (const subscription of this.#options.subscriptions) await this.refresh(subscription);
			} finally {
				this.#running = null;
			}
		})();
		return this.#running;
	}

	async refresh(subscription: Subscription): Promise<boolean> {
		const { db, timeZone } = this.#options;
		const now = this.#options.now?.() ?? Date.now();
		const attempted = new Date(now).toISOString();
		const today = dateInZone(now, timeZone);
		try {
			const body = await download(subscription.url, this.#options.fetcher);
			const occurrences = parseIcs(body, {
				from: addDays(today, -IMPORT_WINDOW.pastDays),
				to: addDays(today, IMPORT_WINDOW.futureDays),
				timeZone
			});
			db.transaction((tx) => {
				tx.delete(imported).where(eq(imported.source, subscription.name)).run();
				for (let i = 0; i < occurrences.length; i += 200) {
					tx.insert(imported)
						.values(occurrences.slice(i, i + 200).map((o) => ({ ...o, source: subscription.name })))
						.run();
				}
				const status = {
					lastAttemptAt: attempted,
					lastSuccessAt: attempted,
					lastError: null,
					count: occurrences.length
				};
				tx.insert(importStatus)
					.values({ source: subscription.name, ...status })
					.onConflictDoUpdate({ target: importStatus.source, set: status })
					.run();
			});
			log('import', `${subscription.name}: ${occurrences.length} occurrences`);
			return true;
		} catch (error) {
			const message = describe(error);
			log('import', `${subscription.name}: could not refresh (${message}); keeping the last copy`);
			db.insert(importStatus)
				.values({ source: subscription.name, lastAttemptAt: attempted, lastError: message })
				.onConflictDoUpdate({
					target: importStatus.source,
					set: { lastAttemptAt: attempted, lastError: message }
				})
				.run();
			return false;
		}
	}

	status(): ImportStatus[] {
		const rows = new Map(
			this.#options.db
				.select()
				.from(importStatus)
				.all()
				.map((row) => [row.source, row])
		);
		return this.#options.subscriptions.map((subscription) => {
			const row = rows.get(subscription.name);
			return {
				name: subscription.name,
				owner: subscription.owner,
				host: new URL(subscription.url).host,
				lastAttemptAt: row?.lastAttemptAt ?? null,
				lastSuccessAt: row?.lastSuccessAt ?? null,
				lastError: row?.lastError ?? null,
				count: row?.count ?? 0
			};
		});
	}
}

/** Cached occurrences from the given sources that touch `from`…`to`. */
export function importedBetween(
	db: Db,
	sources: readonly string[],
	from: string,
	to: string
): (ImportedOccurrence & { source: string; id: number })[] {
	if (sources.length === 0) return [];
	return db
		.select()
		.from(imported)
		.where(
			and(
				inArray(imported.source, [...sources]),
				lte(imported.firstDay, to),
				gte(imported.lastDay, from)
			)
		)
		.all();
}
