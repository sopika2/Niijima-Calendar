import { building } from '$app/environment';
import { personaFromCookie } from '@niijima/design';
import type { Handle, ServerInit } from '@sveltejs/kit';
import { runtime } from '$lib/server/runtime';
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/session';
import { feedTokenMatches } from '$lib/server/tokens';

/**
 * Reachable without signing in: the container health check, the token-protected start-page
 * API, the sign-in screen and flow, and the host's art. The .ics feed gets in only with the
 * right token in its address.
 */
const OPEN_PATHS = new Set([
	'/signin',
	'/healthz',
	'/api/upcoming',
	'/auth/login',
	'/auth/callback'
]);
const OPEN_PREFIXES = ['/assets/'];

const SECURITY_HEADERS: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	'referrer-policy': 'no-referrer',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
	'cross-origin-opener-policy': 'same-origin'
};

export const init: ServerInit = async () => {
	if (!building) await runtime();
};

export const handle: Handle = async ({ event, resolve }) => {
	const app = await runtime();
	const path = event.url.pathname;
	event.locals.user = null;
	event.locals.persona = personaFromCookie(event.request.headers.get('cookie')) ?? 'makoto';

	const open =
		OPEN_PATHS.has(path) ||
		OPEN_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
		feedTokenMatches(path, app.feedToken);

	if (!open && app.access.mode === 'discord') {
		const user = app.access.verify(event.cookies);
		if (!user) {
			const wantsPage = event.request.method === 'GET' && !event.isDataRequest;
			if (wantsPage) {
				const target = path + event.url.search;
				const location = target === '/' ? '/signin' : `/signin?next=${encodeURIComponent(target)}`;
				return new Response(null, { status: 303, headers: { location, ...SECURITY_HEADERS } });
			}
			return new Response('Sign in first.', {
				status: 401,
				headers: { 'content-type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS }
			});
		}
		event.locals.user = { id: user.id, name: user.name };
		// Sliding sign-in: each visit pushes the expiry forward, so you only sign in once.
		if (user.renew) {
			event.cookies.set(
				SESSION_COOKIE,
				createSession(event.locals.user, app.access.sessionSecret),
				sessionCookieOptions(event.url.protocol === 'https:', app.access.cookieDomain)
			);
		}
	}

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%nj.persona%', event.locals.persona)
	});
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!response.headers.has(name)) response.headers.set(name, value);
	}
	return response;
};
