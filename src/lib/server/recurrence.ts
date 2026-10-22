/**
 * Repeating events: which days a series happens on, and the real instants of each occurrence.
 *
 * The rules follow RFC 5545 (and so Google Calendar and iPhone), so the app and the .ics feed
 * always agree:
 * - times are wall-clock times in the event's zone, so a 09:00 meeting stays at 09:00 across a
 *   daylight-saving change;
 * - "monthly" repeats on the same day number and skips months without it (the 31st only happens
 *   in seven months);
 * - "yearly" repeats on the same date, so 29 February only comes round in leap years;
 * - the end date is included.
 */
import {
	addDays,
	addMonths,
	daysInMonth,
	dateText,
	diffDays,
	isLeapYear,
	maxDate,
	monthOf,
	parseDate,
	weekdayOf
} from '../dates.ts';
import type { Series } from '../types.ts';
import { startOfDay, zonedToInstant } from '../zone.ts';

/** The weekdays a weekly series uses: the chosen ones, or the start date's own. */
export function weeklyDays(series: Pick<Series, 'repeatDays' | 'startDate'>): number[] {
	const days = [...new Set(series.repeatDays)].filter((day) => day >= 0 && day <= 6);
	return days.length > 0 ? days.sort((a, b) => a - b) : [weekdayOf(series.startDate)];
}

function matches(series: Series, date: string): boolean {
	if (series.repeat === 'weekly') return weeklyDays(series).includes(weekdayOf(date));
	return true;
}

/**
 * The start dates of a series that fall between `from` and `to` (both included), in order.
 * Dates are local to the series' own zone.
 */
export function occurrenceDates(series: Series, from: string, to: string): string[] {
	const start = series.startDate;
	const last = series.repeatUntil && series.repeatUntil < to ? series.repeatUntil : to;
	const first = maxDate(from, start);
	if (first > last) return [];
	const dates: string[] = [];

	switch (series.repeat) {
		case 'none':
			if (start >= from && start <= last) dates.push(start);
			break;
		case 'daily':
			for (let day = first; day <= last; day = addDays(day, 1)) dates.push(day);
			break;
		case 'weekly': {
			const days = weeklyDays(series);
			for (let day = first; day <= last; day = addDays(day, 1)) {
				if (days.includes(weekdayOf(day))) dates.push(day);
			}
			break;
		}
		case 'monthly': {
			const { day } = parseDate(start);
			for (let month = monthOf(first); month <= monthOf(last); month = addMonths(month, 1)) {
				const [year, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
				if (day > daysInMonth(year, m)) continue;
				const date = dateText(year, m, day);
				if (date >= first && date <= last) dates.push(date);
			}
			break;
		}
		case 'yearly': {
			const { month, day } = parseDate(start);
			for (let year = parseDate(first).year; year <= parseDate(last).year; year++) {
				if (month === 2 && day === 29 && !isLeapYear(year)) continue;
				const date = dateText(year, month, day);
				if (date >= first && date <= last) dates.push(date);
			}
			break;
		}
	}
	return dates;
}

/**
 * The first day the series really happens: the start date itself, or for a weekly series that
 * starts on a day it doesn't use, the next day it does. Null when the end date comes first.
 */
export function firstOccurrence(series: Series): string | null {
	if (matches(series, series.startDate)) {
		return series.repeatUntil && series.repeatUntil < series.startDate ? null : series.startDate;
	}
	return occurrenceDates(series, series.startDate, addDays(series.startDate, 7))[0] ?? null;
}

/**
 * Moves a series' start to its first real occurrence (and the end with it), so what is stored
 * is exactly what the calendar and the feed show.
 */
export function normalizeSeries<T extends Series>(series: T): T {
	const first = firstOccurrence(series);
	if (!first || first === series.startDate) return series;
	const shift = diffDays(series.startDate, first);
	return { ...series, startDate: first, endDate: addDays(series.endDate, shift) };
}

/** One occurrence of a series. */
export interface Instance {
	/** Local start date in the series' zone; identifies the occurrence. */
	readonly date: string;
	readonly allDay: boolean;
	/** All-day: the first and last day (included). */
	readonly startDate: string;
	readonly endDate: string;
	/** Timed: the real start and end, in ms since 1970. Null for all-day events. */
	readonly start: number | null;
	readonly end: number | null;
}

/** How many days after its start an occurrence ends (0 for same-day events). */
export function spanDays(series: Series): number {
	return Math.max(0, diffDays(series.startDate, series.endDate));
}

function instanceOn(series: Series, date: string, span: number): Instance {
	const endDate = addDays(date, span);
	if (series.allDay || !series.startTime || !series.endTime) {
		return { date, allDay: true, startDate: date, endDate, start: null, end: null };
	}
	const start = zonedToInstant(date, series.startTime, series.timeZone);
	const end = zonedToInstant(endDate, series.endTime, series.timeZone);
	return { date, allDay: false, startDate: date, endDate, start, end: Math.max(start, end) };
}

/**
 * Every occurrence that touches the days `from`…`to` (both included) as seen in `viewZone`,
 * including ones that started earlier and are still running. In date order.
 */
export function expandSeries(
	series: Series,
	from: string,
	to: string,
	viewZone: string = series.timeZone
): Instance[] {
	const span = spanDays(series);
	if (series.allDay) {
		return occurrenceDates(series, addDays(from, -span), to).map((date) =>
			instanceOn(series, date, span)
		);
	}
	// A day of slack each side covers the series living in another zone than the view.
	const rangeStart = startOfDay(from, viewZone);
	const rangeEnd = startOfDay(addDays(to, 1), viewZone);
	return occurrenceDates(series, addDays(from, -span - 1), addDays(to, 1))
		.map((date) => instanceOn(series, date, span))
		.filter(
			(instance) =>
				instance.start! < rangeEnd &&
				(instance.end! > rangeStart ||
					(instance.end === instance.start && instance.start! >= rangeStart))
		);
}
