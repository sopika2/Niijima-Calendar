import { inArray, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Owner } from '../types.ts';

/**
 * What one persona sees: her own events and the shared ones. Functions that take a scope leave
 * out everything else; without one they see everything (the feed for both sisters, the API
 * without a persona).
 */
export interface Scope {
	readonly owners: readonly Owner[];
}

/** Makoto's or Sae's view: hers and the shared ones. */
export function scopeFor(persona: 'makoto' | 'sae'): Scope {
	return { owners: [persona, 'shared'] };
}

/** `column IN (owners)`, or nothing without a scope. */
export function ownedBy(column: SQLiteColumn, scope?: Scope | null): SQL | undefined {
	return scope ? inArray(column, [...scope.owners]) : undefined;
}

/** The same test for something already in memory. */
export function inScope(owner: Owner, scope?: Scope | null): boolean {
	return !scope || scope.owners.includes(owner);
}
