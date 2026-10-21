import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ImportService, importedBetween, parseIcs } from './imports.ts';
import { memoryStore } from './testing.ts';

const ics = readFileSync(new URL('./fixtures/google.ics', import.meta.url), 'utf8');
const options = { from: '2026-10-01', to: '2026-10-31', timeZone: 'Europe/Budapest' };

describe('parseIcs', () => {
	const occurrences = parseIcs(ics, options);
	const titled = (title: string) => occurrences.filter((o) => o.title === title);

	it('expands a weekly rule, honouring EXDATE and a moved occurrence', () => {
		expect(titled('Stand-up').map((o) => o.firstDay)).toEqual(['2026-10-05', '2026-10-26']);
		// 12 October is excluded; 19 October was moved to 11:00 and renamed.
		const moved = titled('Stand-up (moved)');
		expect(moved).toHaveLength(1);
		expect(moved[0]!.start).toBe('2026-10-19T09:00:00.000Z');
	});

	it('keeps 09:30 local across the clock change', () => {
		const [early, late] = titled('Stand-up');
		expect(early!.start).toBe('2026-10-05T07:30:00.000Z');
		expect(late!.start).toBe('2026-10-26T08:30:00.000Z');
	});

	it('turns an exclusive all-day end into the last day', () => {
		const [conference] = titled('Conference');
		expect(conference).toMatchObject({
			allDay: true,
			start: '2026-10-23',
			end: '2026-10-24',
			notes: 'Two days\nin Vienna'
		});
	});

	it('unescapes text and drops cancelled events', () => {
		expect(titled('Stand-up')[0]!.location).toBe('Room 3, Floor 2');
		expect(titled('Call')).toHaveLength(0);
		expect(titled('Review')[0]!.firstDay).toBe('2026-10-22');
	});
});

describe('ImportService', () => {
	const subscription = { name: 'Work', url: 'https://example.com/work.ics', owner: 'sae' as const };

	it('caches what it fetched and keeps it when the source is down', async () => {
		const store = memoryStore();
		let up = true;
		const fetcher = (async () => {
			if (!up) throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
			return new Response(ics, { status: 200 });
		}) as typeof fetch;
		const service = new ImportService({
			db: store.db,
			subscriptions: [subscription],
			timeZone: 'Europe/Budapest',
			fetcher,
			now: () => Date.UTC(2026, 9, 21)
		});
		expect(await service.refresh(subscription)).toBe(true);
		const cached = importedBetween(store.db, ['Work'], '2026-10-01', '2026-10-31').length;
		expect(cached).toBe(5);
		const total = service.status()[0]!.count;

		up = false;
		expect(await service.refresh(subscription)).toBe(false);
		expect(importedBetween(store.db, ['Work'], '2026-10-01', '2026-10-31')).toHaveLength(cached);
		const [status] = service.status();
		expect(status).toMatchObject({ name: 'Work', lastError: 'ENOTFOUND', count: total });
		expect(status!.lastSuccessAt).not.toBeNull();
	});

	it('records a page that is not a calendar as an error', async () => {
		const store = memoryStore();
		const service = new ImportService({
			db: store.db,
			subscriptions: [subscription],
			timeZone: 'Europe/Budapest',
			fetcher: (async () => new Response('<html>login</html>')) as typeof fetch
		});
		expect(await service.refresh(subscription)).toBe(false);
		expect(service.status()[0]!.lastError).toMatch(/not return a calendar/);
	});
});
