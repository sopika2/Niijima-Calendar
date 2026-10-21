<script lang="ts">
	import { toast } from '$lib/editor.svelte';

	let visible = $state(false);
	$effect(() => {
		if (!toast.key) return;
		visible = true;
		const timer = setTimeout(() => (visible = false), 2600);
		return () => clearTimeout(timer);
	});
</script>

<div class="toast" class:visible role="status" aria-live="polite">
	{#if visible}{toast.message}{/if}
</div>

<style>
	.toast {
		position: fixed;
		z-index: 50;
		left: 50%;
		bottom: calc(96px + env(safe-area-inset-bottom));
		padding: 10px 20px 8px;
		background: var(--nj-paper);
		color: var(--nj-ink);
		font: 400 20px/1 var(--nj-font-display);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		box-shadow: 6px 6px 0 var(--nj-accent);
		transform: translate(-50%, 20px) rotate(-3deg);
		opacity: 0;
		pointer-events: none;
		transition:
			opacity var(--nj-fast),
			transform var(--nj-normal) var(--nj-snap);
	}
	.toast.visible {
		opacity: 1;
		transform: translate(-50%, 0) rotate(-3deg);
	}
</style>
