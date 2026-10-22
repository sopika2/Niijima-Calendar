/**
 * The .ics feed: the calendar as RFC 5545 iCalendar text, for Google Calendar, the iPhone and
 * Android to subscribe to.
 *
 * Timed events keep their own zone (DTSTART;TZID=Europe/Budapest) with a VTIMEZONE describing
 * it, so a repeating 09:00 stays at 09:00 after the clocks change. All-day events are plain
 * dates. Repeats become RRULEs that mean exactly what the app shows (see recurrence.ts).
 */
import { addDays, diffDays, parseDate, WEEKDAY_SHORT } from '../dates.ts';
import type { EventRecord } from '../types.ts';
import { offsetMinutes, offsetText, zonedParts, zonedToInstant } from '../zone.ts';
import { firstOccurrence, weeklyDays } from './recurrence.ts';

const CRLF = '\r\n';
const BYDAY = WEEKDAY_SHORT.map((day) => day.slice(0, 2));

/** Escapes TEXT values: backslash, semicolon, comma and line breaks (RFC 5545 §3.3.11). */
export function escapeText(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r\n|\r|\n/g, '\\n');
}

const encoder = new TextEncoder();

/**
 * Folds a content line so no line is longer than 75 octets (RFC 5545 §3.1). Continuation lines
 * start with a space; a multi-byte character is never split.
 */
export function foldLine(line: string): string {
	if (encoder.encode(line).length <= 75) return line;
	const lines: string[] = [];
	let current = '';
	let size = 0;
	for (const char of line) {
		const bytes = encoder.encode(char).length;
		const limit = lines.length === 0 ? 75 : 74;
		if (size + bytes > limit) {
			lines.push(current);
			current = '';
			size = 0;
		}
		current += char;
		size += bytes;
	}
	lines.push(current);
	return lines.join(`${CRLF} `);
}

const compactDate = (date: string) => date.replace(/-/g, '');
const compactTime = (time: string, seconds = '00') => `${time.replace(':', '')}${seconds}`;

/** 20261021T070000Z */
export function utcStamp(instant: number): string {
	return new Date(Math.floor(instant / 1000) * 1000)
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

/** The RRULE value for an event, or null when it doesn't repeat. */
export function rrule(event: EventRecord): string | null {
	if (event.repeat === 'none') return null;
	const parts = [`FREQ=${event.repeat.toUpperCase()}`];
	const { month, day } = parseDate(event.startDate);
	if (event.repeat === 'weekly') {
		parts.push(
			`BYDAY=${weeklyDays(event)
				.map((index) => BYDAY[index])
				.join(',')}`,
			'WKST=MO'
		);
	}
	if (event.repeat === 'monthly') parts.push(`BYMONTHDAY=${day}`);
	if (event.repeat === 'yearly') parts.push(`BYMONTH=${month}`, `BYMONTHDAY=${day}`);
	if (event.repeatUntil) {
		// With a zoned start, UNTIL must be UTC: the last moment of the end date, there.
		parts.push(
			event.allDay
				? `UNTIL=${compactDate(event.repeatUntil)}`
				: `UNTIL=${utcStamp(zonedToInstant(addDays(event.repeatUntil, 1), '00:00', event.timeZone) - 1000)}`
		);
	}
	return parts.join(';');
}

interface Transition {
	readonly at: number;
	readonly from: number;
	readonly to: number;
}

/** Every change of UTC offset in a zone between two instants. */
export function transitions(timeZone: string, from: number, to: number): Transition[] {
	const found: Transition[] = [];
	const step = 86_400_000;
	let previous = offsetMinutes(from, timeZone);
	for (let at = from + step; at <= to; at += step) {
		const offset = offsetMinutes(at, timeZone);
		if (offset === previous) continue;
		// Narrow down to the minute.
		let low = at - step;
		let high = at;
		while (high - low > 60_000) {
			const middle = Math.floor((low + high) / 2 / 60_000) * 60_000;
			if (middle <= low) break;
			if (offsetMinutes(middle, timeZone) === previous) low = middle;
			else high = middle;
		}
		found.push({ at: high, from: previous, to: offset });
		previous = offset;
	}
	return found;
}

/** The local wall time at which a transition happens, in the offset before it. */
function localStart(transition: Transition): { date: string; time: string; stamp: string } {
	const wall = new Date(transition.at + transition.from * 60_000);
	const date = wall.toISOString().slice(0, 10);
	const time = wall.toISOString().slice(11, 16);
	return { date, time, stamp: `${compactDate(date)}T${compactTime(time)}` };
}

/** "-1SU" for the last Sunday of a month, "2SU" for the second. */
function weekdayRule(date: string): { last: string; nth: string } {
	const { year, month, day } = parseDate(date);
	const weekday = BYDAY[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;
	const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return {
		last: day + 7 > lastDay ? `-1${weekday}` : '',
		nth: `${Math.ceil(day / 7)}${weekday}`
	};
}

/**
 * Describes a zone for the years `fromYear`…`toYear` as a VTIMEZONE. A yearly pattern (last
 * Sunday of March at 02:00) becomes an RRULE; anything irregular is listed date by date.
 */
export function vtimezone(timeZone: string, fromYear: number, toYear: number): string[] {
	const lines = ['BEGIN:VTIMEZONE', `TZID:${timeZone}`, `X-LIC-LOCATION:${timeZone}`];
	const changes = transitions(timeZone, Date.UTC(fromYear, 0, 1), Date.UTC(toYear + 1, 0, 1));
	if (changes.length === 0) {
		const offset = offsetText(offsetMinutes(Date.UTC(fromYear, 0, 1), timeZone), '');
		lines.push(
			'BEGIN:STANDARD',
			'DTSTART:19700101T000000',
			`TZOFFSETFROM:${offset}`,
			`TZOFFSETTO:${offset}`,
			'END:STANDARD',
			'END:VTIMEZONE'
		);
		return lines;
	}

	const groups = new Map<string, Transition[]>();
	for (const change of changes) {
		const kind = change.to > change.from ? 'DAYLIGHT' : 'STANDARD';
		const key = `${kind} ${change.from} ${change.to}`;
		groups.set(key, [...(groups.get(key) ?? []), change]);
	}
	const lastYear = new Date(changes.at(-1)!.at).getUTCFullYear();

	for (const [key, group] of groups) {
		const kind = key.split(' ')[0]!;
		const first = localStart(group[0]!);
		const starts = group.map(localStart);
		lines.push(
			`BEGIN:${kind}`,
			`DTSTART:${first.stamp}`,
			`TZOFFSETFROM:${offsetText(group[0]!.from, '')}`,
			`TZOFFSETTO:${offsetText(group[0]!.to, '')}`
		);

		const years = starts.map((start) => parseDate(start.date).year);
		const consecutive = years.every((year, i) => i === 0 || year === years[i - 1]! + 1);
		const sameMonthAndTime = starts.every(
			(start) => start.date.slice(5, 7) === first.date.slice(5, 7) && start.time === first.time
		);
		const rules = starts.map((start) => weekdayRule(start.date));
		const byday = rules.every((rule) => rule.last && rule.last === rules[0]!.last)
			? rules[0]!.last
			: rules.every((rule) => rule.nth === rules[0]!.nth)
				? rules[0]!.nth
				: null;

		if (group.length > 1 && consecutive && sameMonthAndTime && byday) {
			// Still going in the last year looked at: it carries on. Otherwise it stopped.
			const ongoing = years.at(-1)! >= lastYear;
			lines.push(
				`RRULE:FREQ=YEARLY;BYMONTH=${Number(first.date.slice(5, 7))};BYDAY=${byday}` +
					(ongoing ? '' : `;UNTIL=${utcStamp(group.at(-1)!.at)}`)
			);
		} else if (group.length > 1) {
			for (const start of starts.slice(1)) lines.push(`RDATE:${start.stamp}`);
		}
		lines.push(`END:${kind}`);
	}
	lines.push('END:VTIMEZONE');
	return lines;
}

export interface CalendarOptions {
	/** Shown as the calendar's name in the subscribing app. */
	readonly name: string;
	/** The default zone (X-WR-TIMEZONE). */
	readonly timeZone: string;
	/** Host name for UIDs, e.g. calendar.niijimasisters.com. */
	readonly domain: string;
	readonly events: readonly EventRecord[];
	/** Category per event, e.g. "Makoto". */
	readonly category?: (event: EventRecord) => string | null;
	readonly now?: number;
}

function stampOf(iso: string): string {
	const ms = Date.parse(iso);
	return utcStamp(Number.isNaN(ms) ? Date.now() : ms);
}

function eventLines(event: EventRecord, options: CalendarOptions): string[] {
	// DTSTART must be the first occurrence, or clients count it as an extra one.
	const first = firstOccurrence(event) ?? event.startDate;
	const shift = diffDays(event.startDate, first);
	const startDate = first;
	const endDate = addDays(event.endDate, shift);

	const lines = [
		'BEGIN:VEVENT',
		`UID:${event.id}@${options.domain}`,
		`DTSTAMP:${stampOf(event.updatedAt)}`,
		`CREATED:${stampOf(event.createdAt)}`,
		`LAST-MODIFIED:${stampOf(event.updatedAt)}`,
		`SEQUENCE:${event.sequence}`
	];
	if (event.allDay || !event.startTime || !event.endTime) {
		lines.push(
			`DTSTART;VALUE=DATE:${compactDate(startDate)}`,
			// The end of an all-day event is the day after it (exclusive).
			`DTEND;VALUE=DATE:${compactDate(addDays(endDate, 1))}`
		);
	} else if (event.timeZone === 'UTC' || event.timeZone === 'Etc/UTC') {
		lines.push(
			`DTSTART:${compactDate(startDate)}T${compactTime(event.startTime)}Z`,
			`DTEND:${compactDate(endDate)}T${compactTime(event.endTime)}Z`
		);
	} else {
		lines.push(
			`DTSTART;TZID=${event.timeZone}:${compactDate(startDate)}T${compactTime(event.startTime)}`,
			`DTEND;TZID=${event.timeZone}:${compactDate(endDate)}T${compactTime(event.endTime)}`
		);
	}
	const rule = rrule({ ...event, startDate, endDate });
	if (rule) lines.push(`RRULE:${rule}`);
	lines.push(`SUMMARY:${escapeText(event.title)}`);
	if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
	if (event.notes) lines.push(`DESCRIPTION:${escapeText(event.notes)}`);
	const category = options.category?.(event);
	if (category) lines.push(`CATEGORIES:${escapeText(category)}`);
	lines.push('TRANSP:' + (event.allDay ? 'TRANSPARENT' : 'OPAQUE'), 'END:VEVENT');
	return lines;
}

/** The whole feed: a VCALENDAR with a VTIMEZONE for each zone in use, then the events. */
export function writeCalendar(options: CalendarOptions): string {
	const now = options.now ?? Date.now();
	const thisYear = new Date(now).getUTCFullYear();
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Niijima Sisters//Niijima Calendar//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(options.name)}`,
		`X-WR-TIMEZONE:${options.timeZone}`,
		'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
		'X-PUBLISHED-TTL:PT1H'
	];

	const zones = new Map<string, number>();
	for (const event of options.events) {
		if (event.allDay || event.timeZone === 'UTC' || event.timeZone === 'Etc/UTC') continue;
		const year = parseDate(event.startDate).year;
		zones.set(event.timeZone, Math.min(zones.get(event.timeZone) ?? year, year));
	}
	for (const [zone, firstYear] of [...zones].sort(([a], [b]) => a.localeCompare(b))) {
		// From the year before the oldest event to a few years ahead, to see the pattern.
		lines.push(...vtimezone(zone, Math.min(firstYear, thisYear) - 1, thisYear + 3));
	}
	for (const event of options.events) lines.push(...eventLines(event, options));
	lines.push('END:VCALENDAR');
	return lines.map(foldLine).join(CRLF) + CRLF;
}

/** The local time "HH:MM" at an instant, for tests and logs. */
export function localTime(instant: number, timeZone: string): string {
	return zonedParts(instant, timeZone).time;
}
