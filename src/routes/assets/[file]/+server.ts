import { error } from '@sveltejs/kit';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { runtime } from '$lib/server/runtime';
import type { RequestHandler } from './$types';

const TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	avif: 'image/avif',
	gif: 'image/gif',
	svg: 'image/svg+xml'
};

/** The host's art from the mounted assets folder, so no image ever has to live in git. */
export const GET: RequestHandler = async ({ params }) => {
	const match = /^[\w-][\w.-]*\.(png|jpe?g|webp|avif|gif|svg)$/i.exec(params.file);
	if (!match) error(404, 'Not found');
	const app = await runtime();
	const path = join(app.assetsDir, params.file);
	try {
		const [body, info] = await Promise.all([readFile(path), stat(path)]);
		return new Response(new Uint8Array(body), {
			headers: {
				'content-type': TYPES[match[1]!.toLowerCase()]!,
				'cache-control': 'public, max-age=3600',
				'last-modified': info.mtime.toUTCString(),
				'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'"
			}
		});
	} catch {
		error(404, 'Not found');
	}
};
