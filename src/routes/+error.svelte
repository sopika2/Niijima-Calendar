<script lang="ts">
	/** Every error as the landing page's Palace: 404s get its own words, others a plain apology. */
	import { Palace } from '@niijima/design/svelte';
	import { page } from '$app/state';

	const missing = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{page.status} · Niijima Calendar</title>
</svelte:head>

{#if missing}
	<Palace
		target={page.url.host + page.url.pathname}
		back={{ label: 'Back to the calendar', href: '/' }}
	/>
{:else}
	<Palace
		code={String(page.status)}
		title="Something went wrong"
		target={page.url.pathname}
		text={page.error?.message && page.status < 500
			? page.error.message
			: 'The calendar tripped over something.\nTry again in a moment.'}
		back={{ label: 'Back to the calendar', href: '/' }}
	/>
{/if}
