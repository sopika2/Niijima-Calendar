import { addDays } from '../dates.ts';
import { isPersona } from '@niijima/design';
import { todayIn } from '../zone.ts';
import { occurrencesBetween, type CalendarContext } from './calendar.ts';
import { scopeFor } from './scope.ts';

export interface UpcomingEvent {
	readonly title: string;
	/** Timed: ISO 8601 with offset. All-day: YYYY-MM-DD. */
	readonly start: string;
	/** Timed: ISO 8601 with offset. All-day: the last day, included. */
	readonly end: string;
	readonly allDay: boolean;
	readonly owner: 'makoto' | 'sae' | 'shared';
	readonly location: string | null;
}

/**
 * What's coming up, for the Niijima Home start page: today and the next `days - 1` days,
 * including imported calendars. Events already over are left out.
 */
export function upcoming(
	context: CalendarContext,
	query: URLSearchParams,
	now = Date.now()
): { events: UpcomingEvent[] } {
	const asked = Number.parseInt(query.get('days') ?? '7', 10);
	const days = Number.isFinite(asked) ? Math.min(60, Math.max(1, asked)) : 7;
	const persona = query.get('persona');
	const scope = isPersona(persona) ? scopeFor(persona) : null;
	const today = todayIn(context.timeZone, now);
	const { occurrences } = occurrencesBetween(context, scope, today, addDays(today, days - 1));
	return {
		events: occurrences
			.filter((o) => o.allDay || Date.parse(o.end) > now || o.start === o.end)
			.map((o) => ({
				title: o.title,
				start: o.start,
				end: o.end,
				allDay: o.allDay,
				owner: o.owner,
				location: o.location
			}))
	};
}
