import { redirect } from '@sveltejs/kit';
import { monthOf } from '$lib/dates';
import { runtime } from '$lib/server/runtime';
import { startView } from '$lib/server/views';
import { todayIn } from '$lib/zone';
import type { PageServerLoad } from './$types';

/** Opens the view you used last; on a first visit, the agenda on a phone and the month on a computer. */
export const load: PageServerLoad = async ({ cookies, request }) => {
	const app = await runtime();
	const today = todayIn(app.timeZone);
	const view = startView(cookies, request.headers.get('user-agent'));
	redirect(
		307,
		view === 'month' ? `/month/${monthOf(today)}` : view === 'day' ? `/day/${today}` : '/agenda'
	);
};
