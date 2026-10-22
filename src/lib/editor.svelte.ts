/**
 * The event sheet: one for the whole app, opened from any view. "view" shows an event,
 * "edit" and "new" show the form.
 */
import type { EventRecord, Occurrence } from './types.ts';

interface EditorState {
	open: boolean;
	mode: 'view' | 'edit' | 'new';
	occurrence: Occurrence | null;
	event: EventRecord | null;
	/** The day a new event starts on. */
	date: string | null;
	/** The time a new event starts at, "HH:MM", when picked on the day view. */
	time: string | null;
	/** Bumped on every open, so the form starts fresh. */
	key: number;
}

export const editor: EditorState = $state({
	open: false,
	mode: 'new',
	occurrence: null,
	event: null,
	date: null,
	time: null,
	key: 0
});

export function openNew(date: string | null = null, time: string | null = null): void {
	Object.assign(editor, {
		open: true,
		mode: 'new',
		occurrence: null,
		event: null,
		date,
		time,
		key: editor.key + 1
	});
}

export function openOccurrence(occurrence: Occurrence, event: EventRecord | null): void {
	Object.assign(editor, {
		open: true,
		mode: 'view',
		occurrence,
		event,
		date: null,
		time: null,
		key: editor.key + 1
	});
}

export function editEvent(): void {
	if (editor.event) Object.assign(editor, { mode: 'edit', key: editor.key + 1 });
}

export function closeEditor(): void {
	editor.open = false;
}

/** A short message at the bottom of the screen. */
export const toast = $state({ message: '', key: 0 });

export function notify(message: string): void {
	toast.message = message;
	toast.key += 1;
}
