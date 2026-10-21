import { describe, expect, it } from 'vitest';
import { upcoming } from './api.ts';
import { createEvent } from './events.ts';
import { memoryStore } from './testing.ts';
import { checkBearer, feedTokenMatches } from './tokens.ts';

describe('checkBearer', () => {
	const token = 'home-token-0123456789';

	it('is off when no token is configured', () => {
		expect(checkBearer(`Bearer ${token}`, null)).toBe('off');
		expect(checkBearer(null, '')).toBe('off');
	});

	it('lets the right token in', () => {
		expect(checkBearer(`Bearer ${token}`, token)).toBe('ok');
		expect(checkBearer(`bearer ${token}`, token)).toBe('ok');
	});

	it('refuses a missing, wrong or malformed token', () => {
		expect(checkBearer(null, token)).toBe('denied');
		expect(checkBearer('', token)).toBe('denied');
		expect(checkBearer(`Bearer ${token}x`, token)).toBe('denied');
		expect(checkBearer(token, token)).toBe('denied');
		expect(checkBearer(`Basic ${token}`, token)).toBe('denied');
		expect(checkBearer('Bearer ', token)).toBe('denied');
	});
});

describe('feedTokenMatches', () => {
	it('only matches /feed/<token>.ics with the configured token', () => {
		expect(feedTokenMatches('/feed/abc123.ics', 'abc123')).toBe(true);
		expect(feedTokenMatches('/feed/abc124.ics', 'abc123')).toBe(false);
		expect(feedTokenMatches('/feed/abc123', 'abc123')).toBe(false);
		expect(feedTokenMatches('/feed/abc123.ics', null)).toBe(false);
		expect(feedTokenMatches('/feed/%E0.ics', 'x')).toBe(false);
	});
});

describe('upcoming', () => {
	const store = memoryStore();
	const base = {
		location: null,
		notes: null,
		timeZone: 'Europe/Budapest',
		repeat: 'none' as const,
		repeatDays: [],
		repeatUntil: null
	};
	createEvent(store.db, {
		...base,
		title: 'Breakfast',
		owner: 'makoto',
		allDay: false,
		startDate: '2026-10-21',
		startTime: '07:00',
		endDate: '2026-10-21',
		endTime: '08:00'
	});
	createEvent(store.db, {
		...base,
		title: 'Hearing',
		owner: 'sae',
		allDay: false,
		startDate: '2026-10-22',
		startTime: '10:00',
		endDate: '2026-10-22',
		endTime: '12:00',
		location: 'Court 4'
	});
	createEvent(store.db, {
		...base,
		title: 'Holiday',
		owner: 'shared',
		allDay: true,
		startDate: '2026-10-23',
		startTime: null,
		endDate: '2026-10-23',
		endTime: null
	});
	const context = { db: store.db, timeZone: 'Europe/Budapest', subscriptions: [] };
	// 21 October 2026, 12:00 in Budapest: breakfast is over.
	const now = Date.UTC(2026, 9, 21, 10);

	it('lists what is coming up, in the documented shape', () => {
		const { events } = upcoming(context, new URLSearchParams('days=7'), now);
		expect(events).toEqual([
			{
				title: 'Hearing',
				start: '2026-10-22T10:00:00+02:00',
				end: '2026-10-22T12:00:00+02:00',
				allDay: false,
				owner: 'sae',
				location: 'Court 4'
			},
			{
				title: 'Holiday',
				start: '2026-10-23',
				end: '2026-10-23',
				allDay: true,
				owner: 'shared',
				location: null
			}
		]);
	});

	it('keeps to one sister when asked, and to the number of days', () => {
		const makoto = upcoming(context, new URLSearchParams('persona=makoto'), now);
		expect(makoto.events.map((e) => e.title)).toEqual(['Holiday']);
		const one = upcoming(context, new URLSearchParams('days=1'), now);
		expect(one.events).toEqual([]);
		const silly = upcoming(context, new URLSearchParams('days=banana'), now);
		expect(silly.events).toHaveLength(2);
	});
});
