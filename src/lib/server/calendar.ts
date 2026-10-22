/**
 * The calendar for a range of days: the sisters' own events expanded into occurrences, plus
 * the imported calendars, all as local dates and times in the calendar's zone.
 */
import { addDays } from '../dates.ts';
import type { EventRecord, Occurrence, Owner } from '../types.ts';
import { dateInZone, isoInZone, zonedParts } from '../zone.ts';
import type { Subscription } from './config.ts';
import type { Db } from './db/client.ts';
import { listEvents } from './events.ts';
import { importedBetween } from './imports.ts';
import { expandSeries, type Instance } from './recurrence.ts';
import { inScope, type Scope } from './scope.ts';

export interface CalendarContext {
	readonly db: Db;
	readonly timeZone: string;
	readonly subscriptions: readonly Subscription[];
}

function occurrenceOf(event: EventRecord, instance: Instance, timeZone: string): Occurrence {
	const shared = {
		key: `${event.id}@${instance.date}`,
		eventId: event.id,
		source: null,
		title: event.title,
		location: event.location,
		notes: event.notes,
		owner: event.owner,
		repeat: event.repeat
	};
	if (instance.allDay) {
		return {
			...shared,
			allDay: true,
			startDate: instance.startDate,
			endDate: instance.endDate,
			startTime: null,
			endTime: null,
			start: instance.startDate,
			end: instance.endDate
		};
	}
	const start = instance.start!;
	const end = instance.end!;
	return {
		...shared,
		allDay: false,
		startDate: dateInZone(start, timeZone),
		endDate: dateInZone(end > start ? end - 1 : end, timeZone),
		startTime: zonedParts(start, timeZone).time,
		endTime: zonedParts(end, timeZone).time,
		start: isoInZone(start, timeZone),
		end: isoInZone(end, timeZone)
	};
}

/** Sorts by day, all-day first, then by time and title. */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
	return (
		a.startDate.localeCompare(b.startDate) ||
		Number(b.allDay) - Number(a.allDay) ||
		(a.startTime ?? '').localeCompare(b.startTime ?? '') ||
		a.title.localeCompare(b.title)
	);
}

/** Imported calendars a scope may see. */
export function visibleSources(subscriptions: readonly Subscription[], scope?: Scope | null) {
	return subscriptions.filter((s) => inScope(s.owner, scope)).map((s) => s.name);
}

/** Every occurrence touching the days `from`…`to` (both included) that the scope can see. */
export function occurrencesBetween(
	context: CalendarContext,
	scope: Scope | null,
	from: string,
	to: string
): { occurrences: Occurrence[]; series: Record<string, EventRecord> } {
	const { db, timeZone } = context;
	const occurrences: Occurrence[] = [];
	const series: Record<string, EventRecord> = {};
	for (const event of listEvents(db, { scope, from, to: addDays(to, 1) })) {
		const instances = expandSeries(event, from, to, timeZone);
		if (instances.length === 0) continue;
		series[event.id] = event;
		for (const instance of instances) occurrences.push(occurrenceOf(event, instance, timeZone));
	}

	const owners = new Map<string, Owner>(context.subscriptions.map((s) => [s.name, s.owner]));
	for (const row of importedBetween(db, visibleSources(context.subscriptions, scope), from, to)) {
		const allDay = row.allDay;
		const start = Date.parse(row.start);
		const end = Date.parse(row.end);
		occurrences.push({
			key: `import:${row.id}`,
			eventId: null,
			source: row.source,
			title: row.title,
			location: row.location,
			notes: row.notes,
			owner: owners.get(row.source) ?? 'shared',
			allDay,
			startDate: row.firstDay,
			endDate: row.lastDay,
			startTime: allDay ? null : zonedParts(start, timeZone).time,
			endTime: allDay ? null : zonedParts(end, timeZone).time,
			start: allDay ? row.start : isoInZone(start, timeZone),
			end: allDay ? row.end : isoInZone(end, timeZone),
			repeat: 'none'
		});
	}
	occurrences.sort(compareOccurrences);
	return { occurrences, series };
}
