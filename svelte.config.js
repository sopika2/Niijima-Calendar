import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Runes everywhere in our own code; libraries decide for themselves.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		// PUBLIC_URL is a server setting like the rest, not a value for the browser.
		env: { publicPrefix: 'BROWSER_' }
	}
};

export default config;
