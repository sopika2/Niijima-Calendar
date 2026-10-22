import { error, json } from '@sveltejs/kit';
import { upcoming } from '$lib/server/api';
import { runtime } from '$lib/server/runtime';
import { checkBearer } from '$lib/server/tokens';
import type { RequestHandler } from './$types';

/**
 * What's coming up, for the Niijima Home start page:
 *   GET /api/upcoming?days=7&persona=makoto   with   Authorization: Bearer <HOME_TOKEN>
 * Off (404) while HOME_TOKEN is empty.
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const app = await runtime();
	const access = checkBearer(request.headers.get('authorization'), app.homeToken);
	if (access === 'off') error(404, 'Not found');
	if (access === 'denied') error(401, 'Missing or wrong token');
	return json(upcoming(app, url.searchParams), { headers: { 'cache-control': 'no-store' } });
};
