import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Compares a secret without leaking how much of it matched. */
export function sameSecret(given: string, expected: string): boolean {
	return timingSafeEqual(digest(given), digest(expected));
}

export type BearerResult = 'off' | 'ok' | 'denied';

/**
 * Checks `Authorization: Bearer <token>`. "off" when no token is configured (the endpoint is
 * then turned off), "denied" for a missing or wrong one.
 */
export function checkBearer(header: string | null, token: string | null | undefined): BearerResult {
	if (!token) return 'off';
	const given = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '')?.[1];
	return given && sameSecret(given, token) ? 'ok' : 'denied';
}

/** The token in a feed path like /feed/<token>.ics, if it is the right one. */
export function feedTokenMatches(pathname: string, token: string | null | undefined): boolean {
	if (!token) return false;
	const given = /^\/feed\/([^/]+)\.ics$/.exec(pathname)?.[1];
	if (!given) return false;
	let decoded: string;
	try {
		decoded = decodeURIComponent(given);
	} catch {
		return false;
	}
	return sameSecret(decoded, token);
}
