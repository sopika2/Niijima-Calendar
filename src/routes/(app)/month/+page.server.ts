import { redirect } from '@sveltejs/kit';
import { monthOf } from '$lib/dates';
import { runtime } from '$lib/server/runtime';
import { todayIn } from '$lib/zone';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = await runtime();
	redirect(307, `/month/${monthOf(todayIn(app.timeZone))}`);
};
