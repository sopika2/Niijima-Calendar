import { redirect } from '@sveltejs/kit';
import { runtime } from '$lib/server/runtime';
import { todayIn } from '$lib/zone';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const app = await runtime();
	redirect(307, `/day/${todayIn(app.timeZone)}`);
};
