import { error } from '@sveltejs/kit';
import { isDate } from '$lib/dates';
import { runtime } from '$lib/server/runtime';
import { calendarFor, rememberView } from '$lib/server/views';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, cookies, url }) => {
	if (!isDate(params.date) || params.date < '1900-01-01' || params.date > '2200-12-31')
		error(404, 'No such day');
	const app = await runtime();
	rememberView(cookies, 'day', url.protocol === 'https:');
	return { date: params.date, ...calendarFor(app, locals.persona, params.date, params.date) };
};
