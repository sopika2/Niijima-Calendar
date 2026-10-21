import type { Cookies } from '@sveltejs/kit';
import type { Persona } from '@niijima/design';
import { occurrencesBetween } from './calendar.ts';
import type { Runtime } from './runtime.ts';
import { scopeFor } from './scope.ts';

export type View = 'month' | 'agenda' | 'day';
export const VIEW_COOKIE = 'nj_cal_view';

/** Remembers the last view, so opening the app goes back to it. */
export function rememberView(cookies: Cookies, view: View, secure: boolean): void {
	cookies.set(VIEW_COOKIE, view, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure,
		maxAge: 31_536_000
	});
}

/** The view to open at /: the last one used, else the agenda on phones and the month elsewhere. */
export function startView(cookies: Cookies, userAgent: string | null): View {
	const remembered = cookies.get(VIEW_COOKIE);
	if (remembered === 'month' || remembered === 'agenda' || remembered === 'day') return remembered;
	return /Mobi|Android|iPhone|iPod/i.test(userAgent ?? '') ? 'agenda' : 'month';
}

/** A persona's calendar between two days, ready for a page. */
export function calendarFor(app: Runtime, persona: Persona, from: string, to: string) {
	return occurrencesBetween(app, scopeFor(persona), from, to);
}
