/** Shapes shared by the server and the pages. */

/**
 * Whose it is: Makoto's, Sae's, or both sisters' (shared). Each persona sees her own and the
 * shared ones.
 */
export const OWNERS = ['makoto', 'sae', 'shared'] as const;
export type Owner = (typeof OWNERS)[number];

export const OWNER_LABELS: Record<Owner, string> = {
	makoto: 'Makoto',
	sae: 'Sae',
	shared: 'Shared'
};

export function isOwner(value: unknown): value is Owner {
	return value === 'makoto' || value === 'sae' || value === 'shared';
}

export const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;
export type Repeat = (typeof REPEATS)[number];

/** How an event repeats: the rule and its end, in the event's own time zone. */
export interface Series {
	readonly allDay: boolean;
	/** First day, YYYY-MM-DD. */
	readonly startDate: string;
	/** "HH:MM", or null for all-day events. */
	readonly startTime: string | null;
	/** Last day (all-day: included) or the day it ends. */
	readonly endDate: string;
	readonly endTime: string | null;
	/** IANA zone the times are in, e.g. Europe/Budapest. */
	readonly timeZone: string;
	readonly repeat: Repeat;
	/** Weekly: the weekdays it happens on, 0 = Sunday. Empty for other rules. */
	readonly repeatDays: readonly number[];
	/** Last day it may happen on (included), or null for no end. */
	readonly repeatUntil: string | null;
}

/** An event as stored: one row, however often it repeats. */
export interface EventRecord extends Series {
	readonly id: string;
	readonly title: string;
	readonly location: string | null;
	readonly notes: string | null;
	readonly owner: Owner;
	readonly sequence: number;
	readonly createdAt: string;
	readonly updatedAt: string;
}

/**
 * One appearance of an event on the calendar, ready to draw: dates and times are already local
 * to the calendar's time zone.
 */
export interface Occurrence {
	/** Unique on the page. */
	readonly key: string;
	/** The event (series) it belongs to, or null for an imported one. */
	readonly eventId: string | null;
	/** The imported calendar's name, or null for the sisters' own events. */
	readonly source: string | null;
	readonly title: string;
	readonly location: string | null;
	readonly notes: string | null;
	readonly owner: Owner;
	readonly allDay: boolean;
	/** First local day it shows on. */
	readonly startDate: string;
	/** Last local day it shows on (included). */
	readonly endDate: string;
	/** "HH:MM" local, null for all-day. */
	readonly startTime: string | null;
	readonly endTime: string | null;
	/** ISO 8601 with offset for timed events; the date for all-day ones. */
	readonly start: string;
	/** ISO 8601 with offset for timed events; the last day (included) for all-day ones. */
	readonly end: string;
	readonly repeat: Repeat;
}

/** What the event form posts back, and gets back with errors. */
export interface EventFields {
	title: string;
	owner: Owner;
	allDay: boolean;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	repeat: Repeat;
	repeatDays: number[];
	repeatUntil: string;
	location: string;
	notes: string;
}

export type FieldErrors = Partial<Record<keyof EventFields | 'form', string>>;

/** The status of one imported calendar, for the Sync page. */
export interface ImportStatus {
	readonly name: string;
	readonly owner: Owner;
	readonly host: string;
	readonly lastAttemptAt: string | null;
	readonly lastSuccessAt: string | null;
	readonly lastError: string | null;
	readonly count: number;
}
