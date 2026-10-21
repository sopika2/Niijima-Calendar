import { describe, expect, it } from 'vitest';
import type { Series } from '../types.ts';
import { isoInZone } from '../zone.ts';
import {
	expandSeries,
	firstOccurrence,
	normalizeSeries,
	occurrenceDates,
	weeklyDays
} from './recurrence.ts';

const BUDAPEST = 'Europe/Budapest';

function series(overrides: Partial<Series> = {}): Series {
	return {
		allDay: false,
		startDate: '2026-10-21',
		startTime: '09:00',
		endDate: '2026-10-21',
		endTime: '10:00',
		timeZone: BUDAPEST,
		repeat: 'none',
		repeatDays: [],
		repeatUntil: null,
		...overrides
	};
}

const iso = (ms: number | null, zone = BUDAPEST) => (ms === null ? null : isoInZone(ms, zone));

describe('occurrenceDates', () => {
	it('gives a one-off event once, inside the range only', () => {
		expect(occurrenceDates(series(), '2026-10-01', '2026-10-31')).toEqual(['2026-10-21']);
		expect(occurrenceDates(series(), '2026-10-22', '2026-10-31')).toEqual([]);
	});

	it('repeats daily from the start, never before it', () => {
		const daily = series({ repeat: 'daily' });
		expect(occurrenceDates(daily, '2026-10-19', '2026-10-24')).toEqual([
			'2026-10-21',
			'2026-10-22',
			'2026-10-23',
			'2026-10-24'
		]);
	});

	it('stops on the end date, which is included', () => {
		const daily = series({ repeat: 'daily', repeatUntil: '2026-10-23' });
		expect(occurrenceDates(daily, '2026-10-01', '2026-10-31')).toEqual([
			'2026-10-21',
			'2026-10-22',
			'2026-10-23'
		]);
	});

	it('repeats weekly on the chosen weekdays', () => {
		// 2026-10-21 is a Wednesday. Mondays and Wednesdays:
		const weekly = series({ repeat: 'weekly', repeatDays: [1, 3] });
		expect(occurrenceDates(weekly, '2026-10-19', '2026-11-04')).toEqual([
			'2026-10-21',
			'2026-10-26',
			'2026-10-28',
			'2026-11-02',
			'2026-11-04'
		]);
	});

	it("uses the start date's weekday when no weekday is picked", () => {
		const weekly = series({ repeat: 'weekly' });
		expect(weeklyDays(weekly)).toEqual([3]);
		expect(occurrenceDates(weekly, '2026-10-01', '2026-11-11')).toEqual([
			'2026-10-21',
			'2026-10-28',
			'2026-11-04',
			'2026-11-11'
		]);
	});

	it('skips months without the day for a monthly series on the 31st', () => {
		const monthly = series({ repeat: 'monthly', startDate: '2026-01-31', endDate: '2026-01-31' });
		expect(occurrenceDates(monthly, '2026-01-01', '2026-12-31')).toEqual([
			'2026-01-31',
			'2026-03-31',
			'2026-05-31',
			'2026-07-31',
			'2026-08-31',
			'2026-10-31',
			'2026-12-31'
		]);
	});

	it('keeps a monthly series on the 30th out of February only', () => {
		const monthly = series({ repeat: 'monthly', startDate: '2027-01-30', endDate: '2027-01-30' });
		expect(occurrenceDates(monthly, '2027-01-01', '2027-04-30')).toEqual([
			'2027-01-30',
			'2027-03-30',
			'2027-04-30'
		]);
	});

	it('brings 29 February round only in leap years', () => {
		const yearly = series({ repeat: 'yearly', startDate: '2024-02-29', endDate: '2024-02-29' });
		expect(occurrenceDates(yearly, '2024-01-01', '2032-12-31')).toEqual([
			'2024-02-29',
			'2028-02-29',
			'2032-02-29'
		]);
		// 2100 is not a leap year.
		expect(occurrenceDates(yearly, '2096-01-01', '2104-12-31')).toEqual([
			'2096-02-29',
			'2104-02-29'
		]);
	});

	it('repeats a birthday every year', () => {
		const yearly = series({
			repeat: 'yearly',
			allDay: true,
			startTime: null,
			endTime: null,
			startDate: '1990-04-17',
			endDate: '1990-04-17'
		});
		expect(occurrenceDates(yearly, '2026-01-01', '2027-12-31')).toEqual([
			'2026-04-17',
			'2027-04-17'
		]);
	});
});

describe('firstOccurrence and normalizeSeries', () => {
	it('moves a weekly series to the first day it really happens', () => {
		// Starts on Wednesday 21 October but only happens on Fridays.
		const weekly = series({ repeat: 'weekly', repeatDays: [5], endDate: '2026-10-22' });
		expect(firstOccurrence(weekly)).toBe('2026-10-23');
		const normal = normalizeSeries(weekly);
		expect(normal.startDate).toBe('2026-10-23');
		expect(normal.endDate).toBe('2026-10-24');
	});

	it('leaves a series that already starts on a matching day alone', () => {
		const weekly = series({ repeat: 'weekly', repeatDays: [3, 5] });
		expect(normalizeSeries(weekly)).toBe(weekly);
	});

	it('has no first occurrence when the end date comes first', () => {
		const weekly = series({ repeat: 'weekly', repeatDays: [5], repeatUntil: '2026-10-22' });
		expect(firstOccurrence(weekly)).toBeNull();
	});
});

describe('expandSeries', () => {
	it('keeps a weekly 09:00 at 09:00 across the October clock change', () => {
		const weekly = series({ repeat: 'weekly' });
		const instances = expandSeries(weekly, '2026-10-20', '2026-11-01');
		expect(instances.map((i) => iso(i.start))).toEqual([
			'2026-10-21T09:00:00+02:00',
			'2026-10-28T09:00:00+01:00'
		]);
		// Same wall-clock time, so a different UTC time.
		expect(instances.map((i) => new Date(i.start!).toISOString())).toEqual([
			'2026-10-21T07:00:00.000Z',
			'2026-10-28T08:00:00.000Z'
		]);
	});

	it('moves a time skipped by the March clock change forward by the gap', () => {
		const daily = series({
			repeat: 'daily',
			startDate: '2026-03-28',
			endDate: '2026-03-28',
			startTime: '02:30',
			endTime: '03:30'
		});
		const instances = expandSeries(daily, '2026-03-28', '2026-03-30');
		expect(instances.map((i) => iso(i.start))).toEqual([
			'2026-03-28T02:30:00+01:00',
			'2026-03-29T03:30:00+02:00',
			'2026-03-30T02:30:00+02:00'
		]);
		// On the day itself both ends land on 03:30: it still shows, just with no length.
		expect(iso(instances[1]!.end)).toBe('2026-03-29T03:30:00+02:00');
	});

	it('takes the first of the two 02:30s when the clocks go back', () => {
		const once = series({
			startDate: '2026-10-25',
			endDate: '2026-10-25',
			startTime: '02:30',
			endTime: '04:00'
		});
		const [instance] = expandSeries(once, '2026-10-25', '2026-10-25');
		expect(iso(instance!.start)).toBe('2026-10-25T02:30:00+02:00');
		expect(iso(instance!.end)).toBe('2026-10-25T04:00:00+01:00');
		// 2.5 real hours, because the hour from 02:00 to 03:00 happens twice.
		expect((instance!.end! - instance!.start!) / 3_600_000).toBe(2.5);
	});

	it('includes an overnight event on the day it ends', () => {
		const overnight = series({
			startDate: '2026-10-21',
			endDate: '2026-10-22',
			startTime: '22:00',
			endTime: '02:00'
		});
		expect(expandSeries(overnight, '2026-10-22', '2026-10-22')).toHaveLength(1);
		expect(expandSeries(overnight, '2026-10-23', '2026-10-23')).toHaveLength(0);
	});

	it('includes a multi-day all-day occurrence that started before the range', () => {
		const trip = series({
			allDay: true,
			startTime: null,
			endTime: null,
			startDate: '2026-10-29',
			endDate: '2026-11-02',
			repeat: 'yearly'
		});
		const instances = expandSeries(trip, '2026-11-01', '2026-11-30');
		expect(instances).toEqual([
			{
				date: '2026-10-29',
				allDay: true,
				startDate: '2026-10-29',
				endDate: '2026-11-02',
				start: null,
				end: null
			}
		]);
	});

	it('leaves out an event that ends exactly when the range starts', () => {
		const late = series({
			startDate: '2026-10-21',
			endDate: '2026-10-22',
			startTime: '23:00',
			endTime: '00:00'
		});
		expect(expandSeries(late, '2026-10-22', '2026-10-22')).toHaveLength(0);
		expect(expandSeries(late, '2026-10-21', '2026-10-21')).toHaveLength(1);
	});

	it('places occurrences by the zone the calendar is viewed in', () => {
		// 01:00 in Tokyo is still the previous evening in Budapest.
		const tokyo = series({ timeZone: 'Asia/Tokyo', startTime: '01:00', endTime: '02:00' });
		expect(expandSeries(tokyo, '2026-10-20', '2026-10-20', BUDAPEST)).toHaveLength(1);
		expect(expandSeries(tokyo, '2026-10-21', '2026-10-21', BUDAPEST)).toHaveLength(0);
	});

	it('expands a long-running daily series quickly', () => {
		const daily = series({ repeat: 'daily', startDate: '2000-01-01', endDate: '2000-01-01' });
		const started = performance.now();
		const instances = expandSeries(daily, '2026-10-01', '2026-10-31');
		expect(instances).toHaveLength(31);
		expect(performance.now() - started).toBeLessThan(200);
	});
});
