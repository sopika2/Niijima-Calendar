/**
 * Calendar dates as `YYYY-MM-DD` text: a day on the wall calendar, with no time and no zone.
 * The arithmetic runs on UTC midnights, so it never meets a daylight-saving change. Shared by
 * the server and the browser.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

export interface DateParts {
	readonly year: number;
	readonly month: number;
	readonly day: number;
}

export function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month (1 = January). */
export function daysInMonth(year: number, month: number): number {
	return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

export function dateText(year: number, month: number, day: number): string {
	return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** A real date like 2026-02-28 (not 2026-02-30). */
export function isDate(text: unknown): text is string {
	if (typeof text !== 'string') return false;
	const match = DATE_RE.exec(text);
	if (!match) return false;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** A month like 2026-10. */
export function isMonth(text: unknown): text is string {
	if (typeof text !== 'string') return false;
	const match = MONTH_RE.exec(text);
	return !!match && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

/** A 24-hour time like 09:30. */
export function isTime(text: unknown): text is string {
	return typeof text === 'string' && TIME_RE.test(text);
}

export function parseDate(text: string): DateParts {
	const match = DATE_RE.exec(text);
	if (!match) throw new Error(`Not a date: ${text}`);
	return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Minutes since midnight for "HH:MM". */
export function minutesOf(time: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	return hours! * 60 + minutes!;
}

export function timeText(minutes: number): string {
	return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

/** UTC midnight of a date, in milliseconds. */
export function dateToUtc(text: string): number {
	const { year, month, day } = parseDate(text);
	return Date.UTC(year, month - 1, day);
}

export function utcToDate(ms: number): string {
	const date = new Date(ms);
	return dateText(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(text: string, days: number): string {
	return utcToDate(dateToUtc(text) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` comes first). */
export function diffDays(from: string, to: string): number {
	return Math.round((dateToUtc(to) - dateToUtc(from)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(text: string): number {
	return new Date(dateToUtc(text)).getUTCDay();
}

export function monthOf(text: string): string {
	return text.slice(0, 7);
}

export function addMonths(month: string, count: number): string {
	const [year, index] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + count];
	const y = year + Math.floor(index / 12);
	const m = ((index % 12) + 12) % 12;
	return `${pad(y, 4)}-${pad(m + 1)}`;
}

export function firstOfMonth(month: string): string {
	return `${month}-01`;
}

export function lastOfMonth(month: string): string {
	const [year, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
	return dateText(year, m, daysInMonth(year, m));
}

export const minDate = (a: string, b: string) => (a < b ? a : b);
export const maxDate = (a: string, b: string) => (a > b ? a : b);

/** Every date from `from` to `to`, both included. */
export function datesBetween(from: string, to: string): string[] {
	const days: string[] = [];
	for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
	return days;
}

export type WeekStart = 0 | 1;

/** The weeks shown for a month: whole weeks from the one holding the 1st to the one holding the last. */
export function monthGrid(month: string, weekStart: WeekStart): string[][] {
	const first = firstOfMonth(month);
	const start = addDays(first, -((weekdayOf(first) - weekStart + 7) % 7));
	const last = lastOfMonth(month);
	const end = addDays(last, (weekStart + 6 - weekdayOf(last) + 7) % 7);
	const weeks: string[][] = [];
	for (let day = start; day <= end; day = addDays(day, 7)) {
		weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
	}
	return weeks;
}

/** Weekday indexes (0 = Sunday) in display order. */
export function weekOrder(weekStart: WeekStart): number[] {
	return Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
}

export const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export const WEEKDAY_LONG = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
] as const;
export const MONTH_LONG = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
] as const;

/** "Tue 21 Oct", "Tuesday 21 October 2026"… */
export function formatDate(text: string, style: 'short' | 'long' | 'full' = 'short'): string {
	const { year, month, day } = parseDate(text);
	const weekday = WEEKDAY_LONG[weekdayOf(text)]!;
	const monthName = MONTH_LONG[month - 1]!;
	if (style === 'short') return `${weekday.slice(0, 3)} ${day} ${monthName.slice(0, 3)}`;
	if (style === 'long') return `${weekday} ${day} ${monthName}`;
	return `${weekday} ${day} ${monthName} ${year}`;
}

/** "October 2026" */
export function formatMonth(month: string): string {
	return `${MONTH_LONG[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}
