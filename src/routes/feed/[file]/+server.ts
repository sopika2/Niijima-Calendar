import { error } from '@sveltejs/kit';
import { isPersona } from '@niijima/design';
import { listEvents } from '$lib/server/events';
import { writeCalendar } from '$lib/server/ics';
import { runtime } from '$lib/server/runtime';
import { scopeFor } from '$lib/server/scope';
import { feedTokenMatches } from '$lib/server/tokens';
import { OWNER_LABELS } from '$lib/types';
import type { RequestHandler } from './$types';

/**
 * The read-only calendar feed phones subscribe to: /feed/<FEED_TOKEN>.ics, everyone's events,
 * or ?persona=makoto|sae for one sister's plus the shared ones. Imported calendars are left
 * out: the phone already has those from their source.
 */
export const GET: RequestHandler = async ({ url }) => {
	const app = await runtime();
	if (!feedTokenMatches(url.pathname, app.feedToken)) error(404, 'Not found');

	const persona = url.searchParams.get('persona');
	const scope = isPersona(persona) ? scopeFor(persona) : null;
	const name = scope
		? `Niijima Calendar · ${OWNER_LABELS[persona as 'makoto' | 'sae']}`
		: 'Niijima Calendar';
	const body = writeCalendar({
		name,
		timeZone: app.timeZone,
		domain: app.publicUrl ? new URL(app.publicUrl).hostname : url.hostname,
		events: listEvents(app.db, { scope }),
		category: (event) => OWNER_LABELS[event.owner]
	});
	return new Response(body, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `inline; filename="niijima-calendar${scope ? `-${persona}` : ''}.ics"`,
			'cache-control': 'private, max-age=300'
		}
	});
};
