import { describe, expect, it } from 'vitest';
import type { Owner } from '../types.ts';
import { occurrencesBetween } from './calendar.ts';
import {
	createEvent,
	deleteEvent,
	getEvent,
	listEvents,
	updateEvent,
	type EventInput
} from './events.ts';
import { imported } from './db/schema.ts';
import { scopeFor } from './scope.ts';
import { memoryStore } from './testing.ts';

function input(title: string, owner: Owner, overrides: Partial<EventInput> = {}): EventInput {
	return {
		title,
		owner,
		location: null,
		notes: null,
		allDay: false,
		startDate: '2026-10-21',
		startTime: '09:00',
		endDate: '2026-10-21',
		endTime: '10:00',
		timeZone: 'Europe/Budapest',
		repeat: 'none',
		repeatDays: [],
		repeatUntil: null,
		...overrides
	};
}

function seeded() {
	const store = memoryStore();
	const ids = {
		makoto: createEvent(store.db, input('Student council', 'makoto')).id,
		sae: createEvent(store.db, input('Court hearing', 'sae')).id,
		shared: createEvent(store.db, input('Dinner together', 'shared')).id
	};
	return { store, ids };
}

const titles = (list: { title: string }[]) => list.map((e) => e.title).sort();

describe('persona scope', () => {
	it("shows each sister her own events and the shared ones, never the other's", () => {
		const { store } = seeded();
		expect(titles(listEvents(store.db, { scope: scopeFor('makoto') }))).toEqual([
			'Dinner together',
			'Student council'
		]);
		expect(titles(listEvents(store.db, { scope: scopeFor('sae') }))).toEqual([
			'Court hearing',
			'Dinner together'
		]);
		expect(listEvents(store.db)).toHaveLength(3);
	});

	it("won't read, change or delete the other sister's event", () => {
		const { store, ids } = seeded();
		const makoto = scopeFor('makoto');
		expect(getEvent(store.db, ids.sae, makoto)).toBeNull();
		expect(updateEvent(store.db, ids.sae, input('Hacked', 'makoto'), makoto)).toBeNull();
		expect(deleteEvent(store.db, ids.sae, makoto)).toBe(false);
		expect(getEvent(store.db, ids.sae)?.title).toBe('Court hearing');
		expect(deleteEvent(store.db, ids.shared, makoto)).toBe(true);
	});

	it('bumps the sequence on every edit', () => {
		const { store, ids } = seeded();
		const updated = updateEvent(store.db, ids.shared, input('Dinner at eight', 'shared'));
		expect(updated?.sequence).toBe(1);
	});

	it('scopes imported calendars by their owner too', () => {
		const { store } = seeded();
		store.db
			.insert(imported)
			.values({
				source: 'Prosecutor’s office',
				uid: 'x',
				title: 'Office party',
				allDay: true,
				start: '2026-10-21',
				end: '2026-10-21',
				firstDay: '2026-10-21',
				lastDay: '2026-10-21'
			})
			.run();
		const context = {
			db: store.db,
			timeZone: 'Europe/Budapest',
			subscriptions: [
				{ name: 'Prosecutor’s office', url: 'https://example.com/a.ics', owner: 'sae' as const }
			]
		};
		const forMakoto = occurrencesBetween(context, scopeFor('makoto'), '2026-10-21', '2026-10-21');
		const forSae = occurrencesBetween(context, scopeFor('sae'), '2026-10-21', '2026-10-21');
		expect(titles(forMakoto.occurrences)).toEqual(['Dinner together', 'Student council']);
		expect(titles(forSae.occurrences)).toEqual([
			'Court hearing',
			'Dinner together',
			'Office party'
		]);
		expect(forSae.occurrences.find((o) => o.title === 'Office party')).toMatchObject({
			source: 'Prosecutor’s office',
			owner: 'sae',
			eventId: null
		});
	});
});
