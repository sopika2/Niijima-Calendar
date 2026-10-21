<script lang="ts">
	import '@niijima/design/niijima.css';
	import '../app.css';
	import { Loader } from '@niijima/design/svelte';
	import { navigating } from '$app/state';

	let { children } = $props();

	/* "Take your time" only when a page is slow to arrive, never as a flash on a quick one. */
	let slow = $state(false);
	$effect(() => {
		if (!navigating.to) {
			slow = false;
			return;
		}
		const timer = setTimeout(() => (slow = true), 400);
		return () => clearTimeout(timer);
	});
</script>

{@render children()}

{#if slow}<Loader />{/if}
