/** Reads and checks the event form. Every message is written for the person filling it in. */
import { diffDays, isDate, isTime, minutesOf } from '../dates.ts';
import {
	isOwner,
	REPEATS,
	type EventFields,
	type FieldErrors,
	type Owner,
	type Repeat
} from '../types.ts';
import type { EventInput } from './events.ts';
import { normalizeSeries } from './recurrence.ts';

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

/** The form as typed, to send back with errors. */
export function fieldsOf(form: FormData, fallbackOwner: Owner): EventFields {
	const owner = field(form, 'owner');
	const repeat = field(form, 'repeat');
	return {
		title: field(form, 'title'),
		owner: isOwner(owner) ? owner : fallbackOwner,
		allDay: form.get('allDay') === 'on' || form.get('allDay') === 'true',
		startDate: field(form, 'startDate'),
		startTime: field(form, 'startTime'),
		endDate: field(form, 'endDate'),
		endTime: field(form, 'endTime'),
		repeat: (REPEATS as readonly string[]).includes(repeat) ? (repeat as Repeat) : 'none',
		repeatDays: form
			.getAll('repeatDays')
			.map(Number)
			.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
		repeatUntil: field(form, 'repeatUntil'),
		location: field(form, 'location'),
		notes: String(form.get('notes') ?? '').trim()
	};
}

export type Checked =
	| { ok: true; input: EventInput; fields: EventFields }
	| { ok: false; errors: FieldErrors; fields: EventFields };

/** Checks the fields; on success gives what to store, in `timeZone`. */
export function checkEvent(fields: EventFields, timeZone: string): Checked {
	const errors: FieldErrors = {};
	if (!fields.title) errors.title = 'Give it a title.';
	else if (fields.title.length > 200) errors.title = 'Keep the title under 200 characters.';

	if (!isDate(fields.startDate)) errors.startDate = 'Pick the day it starts.';
	const endDate = fields.endDate || fields.startDate;
	if (!isDate(endDate)) errors.endDate = 'Pick the day it ends.';
	else if (isDate(fields.startDate) && endDate < fields.startDate)
		errors.endDate = 'It can’t end before it starts.';
	else if (isDate(fields.startDate) && diffDays(fields.startDate, endDate) > 366)
		errors.endDate = 'An event can last a year at most.';

	if (!fields.allDay) {
		if (!isTime(fields.startTime)) errors.startTime = 'Pick a start time.';
		if (!isTime(fields.endTime)) errors.endTime = 'Pick an end time.';
		else if (
			!errors.endDate &&
			isTime(fields.startTime) &&
			endDate === fields.startDate &&
			minutesOf(fields.endTime) < minutesOf(fields.startTime)
		)
			errors.endTime = 'It can’t end before it starts. Ends the next day? Change the end date.';
	}

	if (fields.repeat === 'weekly' && fields.repeatDays.length === 0 && isDate(fields.startDate)) {
		// No weekday picked: the start date's own.
		fields = { ...fields, repeatDays: [new Date(`${fields.startDate}T00:00:00Z`).getUTCDay()] };
	}
	if (fields.repeat !== 'none' && fields.repeatUntil) {
		if (!isDate(fields.repeatUntil)) errors.repeatUntil = 'Pick a valid date, or leave it empty.';
		else if (isDate(fields.startDate) && fields.repeatUntil < fields.startDate)
			errors.repeatUntil = 'The repeats can’t stop before the first one.';
	}
	if (fields.location.length > 200) errors.location = 'Keep the place under 200 characters.';
	if (fields.notes.length > 4000) errors.notes = 'Keep the notes under 4,000 characters.';

	if (Object.keys(errors).length > 0) return { ok: false, errors, fields };

	const input = normalizeSeries<EventInput>({
		title: fields.title,
		location: fields.location || null,
		notes: fields.notes || null,
		owner: fields.owner,
		allDay: fields.allDay,
		startDate: fields.startDate,
		startTime: fields.allDay ? null : fields.startTime,
		endDate,
		endTime: fields.allDay ? null : fields.endTime,
		timeZone,
		repeat: fields.repeat,
		repeatDays: fields.repeat === 'weekly' ? fields.repeatDays : [],
		repeatUntil: fields.repeat === 'none' ? null : fields.repeatUntil || null
	});
	if (input.repeatUntil && input.startDate > input.repeatUntil) {
		return {
			ok: false,
			errors: { repeatUntil: 'None of the chosen weekdays come before this end date.' },
			fields
		};
	}
	return { ok: true, input, fields };
}
