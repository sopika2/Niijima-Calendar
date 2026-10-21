import { json } from '@sveltejs/kit';
import { runtime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

/**
 * For the container health check: 200 while the app and its database work. Imported calendars
 * that can't be fetched make it "degraded", never down. Reveals no events.
 */
export const GET: RequestHandler = async () => {
	const app = await runtime();
	let database = true;
	try {
		app.store.sqlite.prepare('SELECT 1').get();
	} catch {
		database = false;
	}
	const imports = app.imports.status().map((s) => ({
		name: s.name,
		ok: s.lastError === null,
		last_success_at: s.lastSuccessAt
	}));
	const degraded = imports.some((s) => !s.ok);
	return json(
		{
			status: !database ? 'down' : degraded ? 'degraded' : 'ok',
			version: app.version,
			database,
			imports
		},
		{ status: database ? 200 : 503, headers: { 'cache-control': 'no-store' } }
	);
};
