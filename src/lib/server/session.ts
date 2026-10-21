import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Who is signed in. Kept in a signed cookie, so no session table is needed. The format and
 * signature are the same in every Niijima app: with the same SESSION_SECRET and SESSION_DOMAIN
 * one sign-in covers them all.
 */
export interface SessionUser {
	readonly id: string;
	readonly name: string;
}

interface Payload extends SessionUser {
	/** Expiry, in seconds since 1970. */
	readonly exp: number;
}

export const SESSION_COOKIE = 'nj_session';
/** About as long as browsers allow a cookie to live (400 days). Renewed on use. */
export const SESSION_DAYS = 395;
/** Renew the cookie once it is a day old. */
const RENEW_AFTER_SECONDS = 86_400;

const encode = (text: string) => Buffer.from(text).toString('base64url');
const decode = (text: string) => Buffer.from(text, 'base64url').toString('utf8');

function sign(body: string, secret: string): string {
	return createHmac('sha256', secret).update(body).digest('base64url');
}

/** A cookie value proving `user` signed in. */
export function createSession(user: SessionUser, secret: string, now = Date.now()): string {
	const payload: Payload = { ...user, exp: Math.floor(now / 1000) + SESSION_DAYS * 86_400 };
	const body = encode(JSON.stringify(payload));
	return `${body}.${sign(body, secret)}`;
}

export interface ReadSession extends SessionUser {
	/** True when the cookie is old enough to be reissued with a fresh expiry. */
	readonly renew: boolean;
}

/** The user in a cookie value, or null when it is missing, tampered with or expired. */
export function readSession(
	value: string | undefined,
	secret: string,
	now = Date.now()
): ReadSession | null {
	if (!value) return null;
	const [body, signature] = value.split('.');
	if (!body || !signature) return null;
	const expected = Buffer.from(sign(body, secret));
	const given = Buffer.from(signature);
	if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
	try {
		const payload = JSON.parse(decode(body)) as Payload;
		if (typeof payload.id !== 'string' || payload.exp * 1000 < now) return null;
		const issued = payload.exp - SESSION_DAYS * 86_400;
		return {
			id: payload.id,
			name: String(payload.name ?? ''),
			renew: now / 1000 - issued > RENEW_AFTER_SECONDS
		};
	} catch {
		return null;
	}
}

/** Options for the session cookie: shared across subdomains when SESSION_DOMAIN is set. */
export function sessionCookieOptions(secure: boolean, domain: string | null) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure,
		maxAge: SESSION_DAYS * 86_400,
		...(domain ? { domain } : {})
	};
}

/** A random value for the OAuth `state` check. */
export function randomState(): string {
	return randomBytes(24).toString('base64url');
}
