import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.ts';

export type Db = BetterSQLite3Database<typeof schema>;

export interface Store {
	readonly db: Db;
	readonly sqlite: Database.Database;
	close(): void;
}

/** Opens (or creates) the database, applies pending migrations and returns a ready handle. */
export function openDatabase(path: string, migrationsFolder: string): Store {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const sqlite = new Database(path);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');
	sqlite.pragma('synchronous = NORMAL');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder });
	return { db, sqlite, close: () => sqlite.close() };
}
