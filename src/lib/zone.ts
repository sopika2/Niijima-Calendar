/**
 * Wall-clock time in an IANA time zone (Europe/Budapest), worked out with the platform's own
 * time-zone data through Intl, so daylight-saving rules are always the current ones.
 */
import { dateText, dateToUtc, timeText } from './dates.ts';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
	let format = formatters.get(timeZone);
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric'
		});
		formatters.set(timeZone, format);
	}
	return format;
}

export function isTimeZone(value: unknown): value is string {
	if (typeof value !== 'string' || value === '') return false;
	try {
		new Intl.DateTimeFormat('en', { timeZone: value });
		return true;
	} catch {
		return false;
	}
}

interface WallClock {
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly hour: number;
	readonly minute: number;
	readonly second: number;
}

function wallClock(instant: number, timeZone: string): WallClock {
	const parts: Record<string, number> = {};
	for (const part of formatter(timeZone).formatToParts(new Date(instant))) {
		if (part.type !== 'literal') parts[part.type] = Number(part.value);
	}
	return {
		year: parts.year!,
		month: parts.month!,
		day: parts.day!,
		hour: parts.hour! % 24,
		minute: parts.minute!,
		second: parts.second!
	};
}

/** The zone's offset from UTC at an instant, in minutes (Budapest in summer: 120). */
export function offsetMinutes(instant: number, timeZone: string): number {
	const wall = wallClock(instant, timeZone);
	const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
	return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60_000);
}

/** The local date and time ("HH:MM") of an instant in a zone. */
export function zonedParts(instant: number, timeZone: string): { date: string; time: string } {
	const wall = wallClock(instant, timeZone);
	return {
		date: dateText(wall.year, wall.month, wall.day),
		time: timeText(wall.hour * 60 + wall.minute)
	};
}

/**
 * The instant a wall-clock time happens in a zone. Times that don't exist (the hour skipped when
 * clocks go forward) move forward by the gap, so 02:30 becomes 03:30; times that happen twice
 * (the hour repeated when clocks go back) take the first one. That is what calendar apps do.
 */
export function zonedToInstant(date: string, time: string, timeZone: string): number {
	const [hours, minutes] = time.split(':').map(Number);
	const wall = dateToUtc(date) + (hours! * 60 + minutes!) * 60_000;
	const before = offsetMinutes(wall - 86_400_000, timeZone);
	const after = offsetMinutes(wall + 86_400_000, timeZone);
	const candidates = [...new Set([wall - before * 60_000, wall - after * 60_000])]
		.filter((instant) => instant + offsetMinutes(instant, timeZone) * 60_000 === wall)
		.sort((a, b) => a - b);
	// In a gap neither candidate reads back as the wall time; the offset from before the change
	// lands just past it.
	return candidates[0] ?? wall - before * 60_000;
}

/** Midnight at the start of a date in a zone. */
export function startOfDay(date: string, timeZone: string): number {
	return zonedToInstant(date, '00:00', timeZone);
}

/** Today's date in a zone. */
export function todayIn(timeZone: string, now = Date.now()): string {
	return zonedParts(now, timeZone).date;
}

/** "+02:00" */
export function offsetText(minutes: number, separator = ':'): string {
	const sign = minutes < 0 ? '-' : '+';
	const abs = Math.abs(minutes);
	return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}${separator}${String(abs % 60).padStart(2, '0')}`;
}

/** ISO 8601 with the zone's offset: 2026-10-21T09:00:00+02:00. */
export function isoInZone(instant: number, timeZone: string): string {
	const wall = wallClock(instant, timeZone);
	const offset = offsetMinutes(instant, timeZone);
	const date = dateText(wall.year, wall.month, wall.day);
	const time = `${timeText(wall.hour * 60 + wall.minute)}:${String(wall.second).padStart(2, '0')}`;
	return `${date}T${time}${offset === 0 ? 'Z' : offsetText(offset)}`;
}

/** The local date an instant falls on, as seen in a zone. */
export function dateInZone(instant: number, timeZone: string): string {
	return zonedParts(instant, timeZone).date;
}
