import { error } from '@sveltejs/kit';
import { isMonth, monthGrid } from '$lib/dates';
import { runtime } from '$lib/server/runtime';
import { calendarFor, rememberView } from '$lib/server/views';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, cookies, url }) => {
	if (!isMonth(params.month) || params.month < '1900-01' || params.month > '2200-12')
		error(404, 'No such month');
	const app = await runtime();
	rememberView(cookies, 'month', url.protocol === 'https:');
	const weeks = monthGrid(params.month, app.config.week_starts === 'sunday' ? 0 : 1);
	const from = weeks[0]![0]!;
	const to = weeks.at(-1)!.at(-1)!;
	return { month: params.month, weeks, from, to, ...calendarFor(app, locals.persona, from, to) };
};
