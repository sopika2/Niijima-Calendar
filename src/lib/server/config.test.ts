import { describe, expect, it } from 'vitest';
import { parseConfig } from './config.ts';

describe('parseConfig', () => {
	it('gives every default for an empty file', () => {
		const config = parseConfig('');
		expect(config.timezone).toBe('Europe/Budapest');
		expect(config.host.name).toBe('Sae');
		expect(config.subscriptions).toEqual([]);
	});

	it('reads long Discord ids exactly and webcal addresses as https', () => {
		const config = parseConfig(`
access:
  discord_user_ids: [123456789012345678]
subscriptions:
  - name: Work
    url: webcal://calendar.google.com/calendar/ical/x/basic.ics
`);
		expect(config.access.discord_user_ids).toEqual(['123456789012345678']);
		expect(config.subscriptions[0]).toEqual({
			name: 'Work',
			url: 'https://calendar.google.com/calendar/ical/x/basic.ics',
			owner: 'shared'
		});
	});

	it('names the setting that is wrong', () => {
		expect(() => parseConfig('timezone: Mars/Olympus')).toThrow(/timezone: must be an IANA/);
		expect(() =>
			parseConfig('subscriptions: [{name: A, url: "https://a/x"}, {name: A, url: "https://b/y"}]')
		).toThrow(/its own name/);
	});
});
