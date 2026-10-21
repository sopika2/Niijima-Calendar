import { fail, redirect } from '@sveltejs/kit';
import { isDate } from '$lib/dates';
import { createEvent } from '$lib/server/events';
import { runtime } from '$lib/server/runtime';
import { checkEvent, fieldsOf } from '$lib/server/validate';
import { todayIn } from '$lib/zone';
import type { Actions, PageServerLoad } from './$types';

/** The form on its own page, for when the sheet can't open (no JavaScript). */
export const load: PageServerLoad = async ({ url }) => {
	const app = await runtime();
	const date = url.searchParams.get('date');
	return { date: isDate(date) ? date : todayIn(app.timeZone) };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const app = await runtime();
		const checked = checkEvent(fieldsOf(await request.formData(), locals.persona), app.timeZone);
		if (!checked.ok) return fail(400, { errors: checked.errors, fields: checked.fields });
		const event = createEvent(app.db, checked.input);
		redirect(303, `/day/${event.startDate}?saved=1`);
	}
};
