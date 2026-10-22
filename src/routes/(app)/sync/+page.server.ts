import { runtime } from '$lib/server/runtime';
import type { Actions, PageServerLoad } from './$types';

/** Subscribing from a phone, the imported calendars, and the start-page API. */
export const load: PageServerLoad = async ({ url }) => {
	const app = await runtime();
	const origin = app.publicUrl ?? url.origin;
	const feed = app.feedToken ? `${origin}/feed/${encodeURIComponent(app.feedToken)}.ics` : null;
	return {
		feeds: feed
			? [
					{ label: 'Both sisters', url: feed },
					{ label: 'Makoto', url: `${feed}?persona=makoto` },
					{ label: 'Sae', url: `${feed}?persona=sae` }
				]
			: null,
		imports: app.imports.status(),
		api: app.homeToken ? `${origin}/api/upcoming?days=7` : null
	};
};

export const actions: Actions = {
	refresh: async () => {
		const app = await runtime();
		await app.imports.refreshAll();
		return { refreshed: true };
	}
};
