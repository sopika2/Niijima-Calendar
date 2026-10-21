import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hash } from '@niijima/design';
import { runtime } from '$lib/server/runtime';
import { todayIn } from '$lib/zone';
import type { LayoutServerLoad } from './$types';

/** What every calendar page needs: who you are, today, and the host. */
export const load: LayoutServerLoad = async ({ locals }) => {
	const app = await runtime();
	const today = todayIn(app.timeZone);
	const { host } = app.config;
	const artFile = host.art.replace(/^\/assets\//, '');
	// One line a day, the same all day.
	const line = host.lines[hash(`${today}`) % host.lines.length]!;
	return {
		persona: locals.persona,
		today,
		timeZone: app.timeZone,
		weekStart: (app.config.week_starts === 'sunday' ? 0 : 1) as 0 | 1,
		host: {
			name: host.name,
			art: existsSync(join(app.assetsDir, artFile)) ? host.art : null,
			line
		},
		user: locals.user,
		signedIn: app.access.mode === 'discord'
	};
};
