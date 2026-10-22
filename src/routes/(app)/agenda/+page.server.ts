import { addDays } from '$lib/dates';
import { runtime } from '$lib/server/runtime';
import { calendarFor, rememberView } from '$lib/server/views';
import { todayIn } from '$lib/zone';
import type { PageServerLoad } from './$types';

/** The next 60 days, today included. */
const AGENDA_DAYS = 60;

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	const app = await runtime();
	rememberView(cookies, 'agenda', url.protocol === 'https:');
	const from = todayIn(app.timeZone);
	const to = addDays(from, AGENDA_DAYS - 1);
	return { from, to, ...calendarFor(app, locals.persona, from, to) };
};
