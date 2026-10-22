import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import type { EventRecord } from '../types.ts';
import { isoInZone } from '../zone.ts';
import { escapeText, foldLine, rrule, vtimezone, writeCalendar } from './ics.ts';
import { expandSeries } from './recurrence.ts';

const BUDAPEST = 'Europe/Budapest';

function event(overrides: Partial<EventRecord> = {}): EventRecord {
	return {
		id: 'e1',
		title: 'Council meeting',
		location: null,
		notes: null,
		owner: 'makoto',
		allDay: false,
		startDate: '2026-10-21',
		startTime: '09:00',
		endDate: '2026-10-21',
		endTime: '10:00',
		timeZone: BUDAPEST,
		repeat: 'none',
		repeatDays: [],
		repeatUntil: null,
		sequence: 0,
		createdAt: '2026-10-01T10:00:00.000Z',
		updatedAt: '2026-10-02T10:00:00.000Z',
		...overrides
	};
}

const unfold = (text: string) => text.replace(/\r\n[ \t]/g, '');
const write = (events: EventRecord[]) =>
	writeCalendar({
		name: 'Niijima Calendar',
		timeZone: BUDAPEST,
		domain: 'calendar.example',
		events,
		now: Date.UTC(2026, 9, 21)
	});

describe('escapeText', () => {
	it('escapes backslashes, semicolons, commas and line breaks', () => {
		expect(escapeText('a\\b; c, d\r\ne\nf')).toBe('a\\\\b\\; c\\, d\\ne\\nf');
	});
});

describe('foldLine', () => {
	it('leaves short lines alone', () => {
		expect(foldLine('SUMMARY:Short')).toBe('SUMMARY:Short');
	});

	it('folds at 75 octets without splitting a multi-byte character', () => {
		const line = 'SUMMARY:' + '新島姉妹のカレンダー'.repeat(10);
		const folded = foldLine(line);
		const encoder = new TextEncoder();
		for (const part of folded.split('\r\n'))
			expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
		expect(unfold(folded)).toBe(line);
		expect(folded).not.toContain('�');
	});
});

describe('rrule', () => {
	it('writes weekly days and a UTC end for zoned events', () => {
		expect(rrule(event({ repeat: 'weekly', repeatDays: [1, 3], repeatUntil: '2026-12-31' }))).toBe(
			'FREQ=WEEKLY;BYDAY=MO,WE;WKST=MO;UNTIL=20261231T225959Z'
		);
	});

	it('writes a date end for all-day events', () => {
		expect(
			rrule(
				event({
					allDay: true,
					repeat: 'monthly',
					startDate: '2026-01-31',
					repeatUntil: '2026-06-30'
				})
			)
		).toBe('FREQ=MONTHLY;BYMONTHDAY=31;UNTIL=20260630');
	});

	it('is null for one-off events', () => {
		expect(rrule(event())).toBeNull();
	});
});

describe('vtimezone', () => {
	it("describes Budapest's clock changes as yearly rules", () => {
		const text = vtimezone(BUDAPEST, 2025, 2029).join('\n');
		expect(text).toContain(
			'BEGIN:DAYLIGHT\nDTSTART:20250330T020000\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200'
		);
		expect(text).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
		expect(text).toContain(
			'TZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU'
		);
	});

	it('gives a zone without clock changes a single offset', () => {
		const text = vtimezone('Asia/Tokyo', 2025, 2027).join('\n');
		expect(text).toContain('TZOFFSETFROM:+0900\nTZOFFSETTO:+0900');
	});
});

describe('writeCalendar', () => {
	it('writes valid structure with CRLF endings and balanced components', () => {
		const text = write([event({ title: 'Lunch, with Sae; really', notes: 'Line 1\nLine 2' })]);
		expect(text.endsWith('\r\n')).toBe(true);
		expect(text.replace(/\r\n/g, '')).not.toMatch(/\n/);
		const lines = unfold(text).split('\r\n');
		for (const name of ['VCALENDAR', 'VEVENT', 'VTIMEZONE']) {
			expect(lines.filter((l) => l === `BEGIN:${name}`).length).toBe(
				lines.filter((l) => l === `END:${name}`).length
			);
		}
		expect(lines).toContain('DTSTART;TZID=Europe/Budapest:20261021T090000');
		expect(lines).toContain('SUMMARY:Lunch\\, with Sae\\; really');
		expect(lines).toContain('DESCRIPTION:Line 1\\nLine 2');
		expect(lines).toContain('UID:e1@calendar.example');
		expect(lines).toContain('DTSTAMP:20261002T100000Z');
	});

	it('ends all-day events on the day after (exclusive)', () => {
		const text = unfold(
			write([event({ allDay: true, startTime: null, endTime: null, endDate: '2026-10-23' })])
		);
		expect(text).toContain('DTSTART;VALUE=DATE:20261021');
		expect(text).toContain('DTEND;VALUE=DATE:20261024');
		expect(text).not.toContain('BEGIN:VTIMEZONE');
	});

	it('starts a weekly series on its first real occurrence', () => {
		const text = unfold(write([event({ repeat: 'weekly', repeatDays: [5] })]));
		expect(text).toContain('DTSTART;TZID=Europe/Budapest:20261023T090000');
	});

	it('means the same thing to a real iCalendar parser as it does to the app', () => {
		const cases = [
			event({ id: 'weekly', repeat: 'weekly', repeatDays: [1, 3], repeatUntil: '2026-11-30' }),
			event({ id: 'monthly', repeat: 'monthly', startDate: '2026-01-31', endDate: '2026-01-31' }),
			event({
				id: 'leap',
				repeat: 'yearly',
				allDay: true,
				startTime: null,
				endTime: null,
				startDate: '2024-02-29',
				endDate: '2024-02-29'
			}),
			event({ id: 'daily', repeat: 'daily', startDate: '2026-10-23', endDate: '2026-10-23' })
		];
		const calendar = new ICAL.Component(ICAL.parse(write(cases)));
		for (const vtz of calendar.getAllSubcomponents('vtimezone')) {
			ICAL.TimezoneService.register(vtz);
		}
		const vevents = calendar.getAllSubcomponents('vevent');
		const windowEnd = ICAL.Time.fromDateString('2029-01-01');
		for (const series of cases) {
			const component = vevents.find(
				(v) => v.getFirstPropertyValue('uid') === `${series.id}@calendar.example`
			)!;
			const parsed = new ICAL.Event(component);
			const iterator = parsed.iterator();
			const theirs: string[] = [];
			for (
				let next = iterator.next();
				next && next.compare(windowEnd) < 0;
				next = iterator.next()
			) {
				theirs.push(next.isDate ? next.toString() : isoInZone(next.toUnixTime() * 1000, BUDAPEST));
				if (theirs.length > 200) break;
			}
			const ours = expandSeries(series, '2024-01-01', '2028-12-31').map((i) =>
				i.allDay ? i.startDate : isoInZone(i.start!, BUDAPEST)
			);
			expect(theirs.slice(0, 60)).toEqual(ours.slice(0, 60));
		}
	});
});
