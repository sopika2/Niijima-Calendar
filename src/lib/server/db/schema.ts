import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { OWNERS, REPEATS } from '../../types.ts';

/*
 * Three tables. Dates are YYYY-MM-DD text, times "HH:MM" wall-clock text in the event's own
 * zone, timestamps ISO 8601 in UTC. A repeating event is one row; occurrences are worked out
 * when they are shown (recurrence.ts).
 */

const now = () => new Date().toISOString();
const flag = (name: string) => integer(name, { mode: 'boolean' });

/** The sisters' own events. */
export const events = sqliteTable(
	'events',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		title: text('title').notNull(),
		location: text('location'),
		notes: text('notes'),
		/** Whose it is; each persona sees her own and the shared ones. */
		owner: text('owner', { enum: OWNERS }).notNull().default('shared'),
		allDay: flag('all_day').notNull().default(false),
		startDate: text('start_date').notNull(),
		startTime: text('start_time'),
		endDate: text('end_date').notNull(),
		endTime: text('end_time'),
		/** The IANA zone the times were entered in, so a later config change can't move them. */
		timeZone: text('time_zone').notNull(),
		repeat: text('repeat', { enum: REPEATS }).notNull().default('none'),
		/** Weekly: comma-separated weekdays, 0 = Sunday. */
		repeatDays: text('repeat_days').notNull().default(''),
		repeatUntil: text('repeat_until'),
		/** Goes up on every edit, so subscribed calendars notice changes. */
		sequence: integer('sequence').notNull().default(0),
		createdAt: text('created_at').notNull().$defaultFn(now),
		updatedAt: text('updated_at').notNull().$defaultFn(now)
	},
	(table) => [index('events_owner_start_idx').on(table.owner, table.startDate)]
);

/**
 * Occurrences from subscribed calendars (config.yml → subscriptions), already expanded. Replaced
 * wholesale on each successful fetch; read-only in the app.
 */
export const imported = sqliteTable(
	'imported',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** The subscription's name from config.yml. */
		source: text('source').notNull(),
		uid: text('uid').notNull(),
		title: text('title').notNull(),
		location: text('location'),
		notes: text('notes'),
		allDay: flag('all_day').notNull(),
		/** All-day: the first day. Timed: ISO instant in UTC. */
		start: text('start').notNull(),
		/** All-day: the last day (included). Timed: ISO instant in UTC. */
		end: text('end').notNull(),
		/** First and last local day it shows on, in the calendar's zone. */
		firstDay: text('first_day').notNull(),
		lastDay: text('last_day').notNull()
	},
	(table) => [index('imported_source_day_idx').on(table.source, table.firstDay)]
);

/** How each subscribed calendar's last fetch went. */
export const importStatus = sqliteTable('import_status', {
	source: text('source').primaryKey(),
	lastAttemptAt: text('last_attempt_at'),
	lastSuccessAt: text('last_success_at'),
	lastError: text('last_error'),
	count: integer('count').notNull().default(0)
});
