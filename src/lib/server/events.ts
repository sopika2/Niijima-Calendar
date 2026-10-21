import { and, eq, isNull, lte, or, gte, sql } from 'drizzle-orm';
import type { EventRecord, Owner, Repeat } from '../types.ts';
import type { Db } from './db/client.ts';
import { events } from './db/schema.ts';
import { ownedBy, type Scope } from './scope.ts';

type Row = typeof events.$inferSelect;

export function toRecord(row: Row): EventRecord {
	return {
		id: row.id,
		title: row.title,
		location: row.location,
		notes: row.notes,
		owner: row.owner,
		allDay: row.allDay,
		startDate: row.startDate,
		startTime: row.startTime,
		endDate: row.endDate,
		endTime: row.endTime,
		timeZone: row.timeZone,
		repeat: row.repeat,
		repeatDays: row.repeatDays
			.split(',')
			.filter(Boolean)
			.map(Number)
			.filter((day) => day >= 0 && day <= 6),
		repeatUntil: row.repeatUntil,
		sequence: row.sequence,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt
	};
}

/** What a new or edited event holds. */
export interface EventInput {
	readonly title: string;
	readonly location: string | null;
	readonly notes: string | null;
	readonly owner: Owner;
	readonly allDay: boolean;
	readonly startDate: string;
	readonly startTime: string | null;
	readonly endDate: string;
	readonly endTime: string | null;
	readonly timeZone: string;
	readonly repeat: Repeat;
	readonly repeatDays: readonly number[];
	readonly repeatUntil: string | null;
}

function values(input: EventInput) {
	return {
		...input,
		repeatDays: input.repeat === 'weekly' ? [...input.repeatDays].sort().join(',') : '',
		repeatUntil: input.repeat === 'none' ? null : input.repeatUntil
	};
}

/**
 * Events in a scope that could show between two dates: ones that start by the end and haven't
 * finished (or stopped repeating) more than `slackDays` before the start. The exact
 * occurrences are worked out by recurrence.ts.
 */
export function listEvents(
	db: Db,
	options: { scope?: Scope | null; from?: string; to?: string } = {}
): EventRecord[] {
	const { scope, from, to } = options;
	const conditions = [ownedBy(events.owner, scope)];
	if (to) conditions.push(lte(events.startDate, to));
	if (from) {
		// Multi-day events and other zones: a week of slack is plenty.
		const early = sql`date(${from}, '-7 days')`;
		conditions.push(
			or(
				and(eq(events.repeat, 'none'), gte(events.endDate, early)),
				and(
					sql`${events.repeat} != 'none'`,
					or(isNull(events.repeatUntil), gte(events.repeatUntil, early))
				)
			)
		);
	}
	return db
		.select()
		.from(events)
		.where(and(...conditions))
		.orderBy(events.startDate, events.startTime)
		.all()
		.map(toRecord);
}

export function getEvent(db: Db, id: string, scope?: Scope | null): EventRecord | null {
	const row = db
		.select()
		.from(events)
		.where(and(eq(events.id, id), ownedBy(events.owner, scope)))
		.get();
	return row ? toRecord(row) : null;
}

export function createEvent(db: Db, input: EventInput): EventRecord {
	const row = db.insert(events).values(values(input)).returning().get();
	return toRecord(row);
}

/** Saves an edit; repeating events change as a whole series. Null when not found in scope. */
export function updateEvent(
	db: Db,
	id: string,
	input: EventInput,
	scope?: Scope | null
): EventRecord | null {
	const row = db
		.update(events)
		.set({
			...values(input),
			sequence: sql`${events.sequence} + 1`,
			updatedAt: new Date().toISOString()
		})
		.where(and(eq(events.id, id), ownedBy(events.owner, scope)))
		.returning()
		.get();
	return row ? toRecord(row) : null;
}

/** Deletes an event (every occurrence). False when not found in scope. */
export function deleteEvent(db: Db, id: string, scope?: Scope | null): boolean {
	const result = db
		.delete(events)
		.where(and(eq(events.id, id), ownedBy(events.owner, scope)))
		.run();
	return result.changes > 0;
}
