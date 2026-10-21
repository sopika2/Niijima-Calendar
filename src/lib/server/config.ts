import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { OWNERS } from '../types.ts';
import { isTimeZone } from '../zone.ts';

const DEFAULT_LINES = [
	'Your schedule. I expect you to keep it — no excuses.',
	'A good prosecutor never misses a hearing. Check what is coming up.',
	"Plans are only as good as the follow-through. Let's see the week.",
	"Don't let the days ambush you. Read the calendar first."
];

const discordId = z
	.union([z.string(), z.number(), z.bigint()])
	.transform(String)
	.pipe(z.string().regex(/^\d{15,21}$/, { message: 'must be a Discord user id (digits only)' }));

const subscription = z.strictObject({
	name: z.string().trim().min(1).max(60),
	url: z
		.string()
		.trim()
		.transform((url) => url.replace(/^webcal:\/\//i, 'https://'))
		.pipe(z.url({ protocol: /^https?$/, message: 'must be an http(s) or webcal address' })),
	owner: z.enum(OWNERS).default('shared')
});

export const configSchema = z.strictObject({
	/** The zone every date and time is shown in, e.g. Europe/Budapest. */
	timezone: z
		.string()
		.refine(isTimeZone, { message: 'must be an IANA time zone such as Europe/Budapest' })
		.default('Europe/Budapest'),
	/** First column of the month grid. */
	week_starts: z.enum(['monday', 'sunday']).default('monday'),
	/** The character who greets you. */
	host: z
		.strictObject({
			name: z.string().min(1).default('Sae'),
			/** An image under /assets/, from the mounted assets folder. */
			art: z
				.string()
				.regex(/^\/assets\/[\w.-]+$/, { message: 'must look like /assets/sae.webp' })
				.default('/assets/sae.webp'),
			lines: z.array(z.string().min(1)).min(1).default(DEFAULT_LINES)
		})
		.prefault({}),
	access: z
		.strictObject({
			discord_user_ids: z.array(discordId).default([])
		})
		.prefault({}),
	/** Other calendars to show read-only (a Google Calendar's secret iCal address…). */
	subscriptions: z
		.array(subscription)
		.default([])
		.refine((list) => new Set(list.map((s) => s.name)).size === list.length, {
			message: 'each subscription needs its own name'
		})
});

export type Config = z.output<typeof configSchema>;
export type Subscription = Config['subscriptions'][number];

/** Validates config.yml text. An empty file gives all defaults. */
export function parseConfig(text: string, file = 'config.yml'): Config {
	let raw: unknown;
	try {
		// Discord ids are too long for a JS number; read integers exactly.
		raw = parseYaml(text, { intAsBigInt: true }) ?? {};
	} catch (error) {
		throw new Error(
			`${file} is not valid YAML: ${error instanceof Error ? error.message : error}`,
			{
				cause: error
			}
		);
	}
	const result = configSchema.safeParse(raw);
	if (!result.success) {
		const issues = result.error.issues
			.map((issue) => `  ${issue.path.join('.') || '(top)'}: ${issue.message}`)
			.join('\n');
		throw new Error(`${file} has problems:\n${issues}`);
	}
	return result.data;
}
