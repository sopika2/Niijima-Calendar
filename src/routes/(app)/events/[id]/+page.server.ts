import { error, fail, redirect } from '@sveltejs/kit';
import { deleteEvent, getEvent, updateEvent } from '$lib/server/events';
import { runtime } from '$lib/server/runtime';
import { scopeFor } from '$lib/server/scope';
import { checkEvent, fieldsOf } from '$lib/server/validate';
import type { Actions, PageServerLoad } from './$types';

/** One event's form on its own page (no JavaScript), plus saving and deleting. */
export const load: PageServerLoad = async ({ params, locals }) => {
	const app = await runtime();
	const event = getEvent(app.db, params.id, scopeFor(locals.persona));
	if (!event) error(404, 'No such event');
	return { event };
};

export const actions: Actions = {
	save: async ({ request, params, locals }) => {
		const app = await runtime();
		const checked = checkEvent(fieldsOf(await request.formData(), locals.persona), app.timeZone);
		if (!checked.ok) return fail(400, { errors: checked.errors, fields: checked.fields });
		const event = updateEvent(app.db, params.id, checked.input, scopeFor(locals.persona));
		if (!event)
			return fail(404, { errors: { form: 'That event is gone, or isn’t yours to change.' } });
		redirect(303, `/day/${event.startDate}?saved=1`);
	},
	delete: async ({ params, locals }) => {
		const app = await runtime();
		const event = getEvent(app.db, params.id, scopeFor(locals.persona));
		if (!event || !deleteEvent(app.db, params.id, scopeFor(locals.persona))) {
			return fail(404, { errors: { form: 'That event is gone, or isn’t yours to delete.' } });
		}
		redirect(303, `/day/${event.startDate}?deleted=1`);
	}
};
