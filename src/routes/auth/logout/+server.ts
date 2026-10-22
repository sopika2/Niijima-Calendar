import { redirect } from '@sveltejs/kit';
import { runtime } from '$lib/server/runtime';
import { SESSION_COOKIE } from '$lib/server/session';
import type { RequestHandler } from './$types';

/** Signs you out on this device (of every Niijima app, when the cookie is shared). */
export const POST: RequestHandler = async ({ cookies }) => {
	const app = await runtime();
	const domain = app.access.cookieDomain;
	cookies.delete(SESSION_COOKIE, { path: '/', ...(domain ? { domain } : {}) });
	redirect(303, '/signin?m=signed_out');
};
