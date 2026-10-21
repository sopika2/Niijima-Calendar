/** Small wording helpers for the pages. */
import { formatDate, parseDate, WEEKDAY_LONG, MONTH_LONG } from './dates.ts';
import type { EventRecord, Occurrence } from './types.ts';

/** "09:00–10:30", "All day", "From 22:00", "Until 02:00". */
export function timeRange(occurrence: Occurrence, onDate?: string): string {
	if (occurrence.allDay) return 'All day';
	const starts = !onDate || onDate === occurrence.startDate;
	const ends = !onDate || onDate === occurrence.endDate;
	if (starts && ends) {
		return occurrence.startTime === occurrence.endTime
			? occurrence.startTime!
			: `${occurrence.startTime}–${occurrence.endTime}`;
	}
	if (starts) return `From ${occurrence.startTime}`;
	if (ends) return `Until ${occurrence.endTime}`;
	return 'All day';
}

/** "Tue 21 Oct, 09:00–10:00" or "Thu 23 Oct – Sat 25 Oct". */
export function whenText(occurrence: Occurrence): string {
	const sameDay = occurrence.startDate === occurrence.endDate;
	if (occurrence.allDay) {
		return sameDay
			? `${formatDate(occurrence.startDate, 'long')}, all day`
			: `${formatDate(occurrence.startDate)} – ${formatDate(occurrence.endDate)}`;
	}
	return sameDay
		? `${formatDate(occurrence.startDate, 'long')}, ${timeRange(occurrence)}`
		: `${formatDate(occurrence.startDate)} ${occurrence.startTime} – ${formatDate(occurrence.endDate)} ${occurrence.endTime}`;
}

const ordinal = (n: number) =>
	`${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

/** "Every week on Monday and Wednesday, until 31 Dec 2026". */
export function repeatText(event: EventRecord): string | null {
	const { month, day } = parseDate(event.startDate);
	let text: string;
	switch (event.repeat) {
		case 'none':
			return null;
		case 'daily':
			text = 'Every day';
			break;
		case 'weekly': {
			const days = (
				event.repeatDays.length
					? event.repeatDays
					: [new Date(`${event.startDate}T00:00:00Z`).getUTCDay()]
			).map((d) => WEEKDAY_LONG[d]!);
			const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${days.at(-1)}` : days[0];
			text = `Every week on ${list}`;
			break;
		}
		case 'monthly':
			text = `Every month on the ${ordinal(day)}`;
			break;
		case 'yearly':
			text = `Every year on ${day} ${MONTH_LONG[month - 1]}`;
			break;
	}
	return event.repeatUntil ? `${text}, until ${formatDate(event.repeatUntil, 'full')}` : text;
}

/** Google Maps search for a place. */
export function mapLink(location: string): string {
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

/** Groups occurrences by the days they show on, within `from`…`to`. */
export function byDay(occurrences: readonly Occurrence[], from: string, to: string) {
	const days = new Map<string, Occurrence[]>();
	for (const occurrence of occurrences) {
		const first = occurrence.startDate < from ? from : occurrence.startDate;
		const last = occurrence.endDate > to ? to : occurrence.endDate;
		for (let day = first; day <= last;) {
			const list = days.get(day) ?? [];
			list.push(occurrence);
			days.set(day, list);
			const next = new Date(`${day}T00:00:00Z`);
			next.setUTCDate(next.getUTCDate() + 1);
			day = next.toISOString().slice(0, 10);
		}
	}
	return days;
}
