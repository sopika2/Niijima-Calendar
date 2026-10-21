/** Helpers for tests: a fresh in-memory database with the real migrations. */
import { fileURLToPath } from 'node:url';
import { openDatabase, type Store } from './db/client.ts';

export function memoryStore(): Store {
	return openDatabase(':memory:', fileURLToPath(new URL('../../../drizzle', import.meta.url)));
}
