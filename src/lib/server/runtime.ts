import { env } from '$env/dynamic/private';
import { Cron } from 'croner';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { accessOff, discordAccess, type AccessGate } from './access.ts';
import type { CalendarContext } from './calendar.ts';
import { parseConfig, type Config } from './config.ts';
import { openDatabase, type Store } from './db/client.ts';
import { ImportService } from './imports.ts';
import { log, logError } from './log.ts';

export interface Runtime extends CalendarContext {
	readonly version: string;
	readonly startedAt: Date;
	readonly config: Config;
	readonly store: Store;
	readonly imports: ImportService;
	readonly access: AccessGate;
	/** Token in the .ics feed address; null turns the feed off. */
	readonly feedToken: string | null;
	/** Token the Niijima Home start page sends to /api/upcoming; null turns the API off. */
	readonly homeToken: string | null;
	/** The address people open, without a trailing slash, when PUBLIC_URL is set. */
	readonly publicUrl: string | null;
	/** Folder with the host's art (mounted ./assets). */
	readonly assetsDir: string;
}

declare const __CALENDAR_VERSION__: string;

const KEY = Symbol.for('niijima-calendar.runtime');
type Holder = { [KEY]?: Promise<Runtime> };

const value = (name: string): string | null => {
	const raw = env[name];
	return raw === undefined || raw.trim() === '' ? null : raw.trim();
};

/** The booted app, created on first use. */
export function runtime(): Promise<Runtime> {
	const holder = globalThis as Holder;
	holder[KEY] ??= boot();
	return holder[KEY];
}

function readConfig(path: string): Config {
	if (!existsSync(path)) {
		log('config', `${path} not found; using defaults. Copy config.example.yml to config.yml.`);
		return parseConfig('');
	}
	return parseConfig(readFileSync(path, 'utf8'));
}

function accessGate(config: Config): AccessGate {
	const mode = value('ACCESS_MODE') ?? 'off';
	if (mode !== 'discord' && mode !== 'off') throw new Error('ACCESS_MODE must be discord or off');
	if (mode === 'off') return accessOff();
	const required = {
		DISCORD_CLIENT_ID: value('DISCORD_CLIENT_ID'),
		DISCORD_CLIENT_SECRET: value('DISCORD_CLIENT_SECRET'),
		SESSION_SECRET: value('SESSION_SECRET'),
		PUBLIC_URL: value('PUBLIC_URL')
	};
	const missing = Object.entries(required)
		.filter(([, v]) => !v)
		.map(([name]) => name);
	if (missing.length > 0) {
		throw new Error(
			`Discord sign-in needs ${missing.join(', ')} in .env (see README), ` +
				'or ACCESS_MODE=off for local development only.'
		);
	}
	if (required.SESSION_SECRET!.length < 32) {
		throw new Error('SESSION_SECRET must be at least 32 characters (openssl rand -hex 32).');
	}
	if (config.access.discord_user_ids.length === 0) {
		log('boot', 'No Discord accounts are allowed yet. Sign in once: the page shows your id.');
	}
	return discordAccess({
		app: {
			clientId: required.DISCORD_CLIENT_ID!,
			clientSecret: required.DISCORD_CLIENT_SECRET!,
			redirectUri: `${required.PUBLIC_URL!.replace(/\/+$/, '')}/auth/callback`
		},
		sessionSecret: required.SESSION_SECRET!,
		allowedIds: config.access.discord_user_ids,
		cookieDomain: value('SESSION_DOMAIN')
	});
}

async function boot(): Promise<Runtime> {
	const version = typeof __CALENDAR_VERSION__ === 'string' ? __CALENDAR_VERSION__ : 'dev';
	log('boot', `Niijima Calendar ${version} starting`);

	const config = readConfig(resolve(value('CALENDAR_CONFIG') ?? 'config.yml'));
	const access = accessGate(config);
	const dataDir = resolve(value('CALENDAR_DATA') ?? 'data');
	const store = openDatabase(
		join(dataDir, 'calendar.db'),
		resolve(value('CALENDAR_MIGRATIONS') ?? 'drizzle')
	);
	const imports = new ImportService({
		db: store.db,
		subscriptions: config.subscriptions,
		timeZone: config.timezone
	});

	// Imported calendars: now, then every 30 minutes. Failures only log; the cache stays.
	const job = new Cron('*/30 * * * *', { protect: true, name: 'imports' }, async () => {
		try {
			await imports.refreshAll();
		} catch (error) {
			logError('imports', error);
		}
	});
	if (config.subscriptions.length > 0) void imports.refreshAll();

	process.once('sveltekit:shutdown', () => {
		job.stop();
		store.close();
		log('boot', 'stopped');
	});

	const app: Runtime = {
		version,
		startedAt: new Date(),
		config,
		db: store.db,
		timeZone: config.timezone,
		subscriptions: config.subscriptions,
		store,
		imports,
		access,
		feedToken: value('FEED_TOKEN'),
		homeToken: value('HOME_TOKEN'),
		publicUrl: value('PUBLIC_URL')?.replace(/\/+$/, '') ?? null,
		assetsDir: resolve(value('CALENDAR_ASSETS') ?? 'assets')
	};
	log(
		'boot',
		`ready · ${config.timezone} · access ${access.mode} · feed ${app.feedToken ? 'on' : 'off'} · ` +
			`home API ${app.homeToken ? 'on' : 'off'} · ${config.subscriptions.length} subscription(s)`
	);
	if (access.mode === 'off')
		log('boot', 'No sign-in (ACCESS_MODE=off): anyone who can reach this app gets in.');
	return app;
}
