<script lang="ts">
	/**
	 * The host greets you: her art (from the mounted assets folder) and a line in a speech box.
	 * Without art, an ink silhouette stands in, never a broken image.
	 */
	import { Speech } from '@niijima/design/svelte';

	interface Props {
		host: { name: string; art: string | null; line: string };
		/** A second, practical line: what's on today. */
		note?: string | null;
		compact?: boolean;
	}

	let { host, note = null, compact = false }: Props = $props();
	let broken = $state(false);
</script>

<div class="host" class:compact>
	<div class="art" aria-hidden="true">
		{#if host.art && !broken}
			<img src={host.art} alt="" onerror={() => (broken = true)} />
		{:else}
			<svg viewBox="0 0 100 120" class="silhouette">
				<path
					d="M50 12c-17 0-29 13-29 31 0 9 3 17 8 23-3 2-6 4-6 8l-3 5c-11 4-18 12-20 41h100c-2-29-9-37-20-41l-3-5c0-4-3-6-6-8 5-6 8-14 8-23 0-18-12-31-29-31z"
				/>
			</svg>
		{/if}
	</div>
	<div class="speech">
		<Speech tag={{ word: host.name }} tail={!compact}>
			<p class="line">{host.line}</p>
			{#if note}<p class="note">{note}</p>{/if}
		</Speech>
	</div>
</div>

<style>
	.host {
		position: relative;
		display: grid;
		justify-items: end;
		padding-top: 4px;
	}
	.art {
		width: 150px;
		height: 170px;
		margin-right: 4%;
		margin-bottom: 36px;
	}
	.art img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: bottom;
		filter: drop-shadow(6px 6px 0 var(--nj-accent));
	}
	.silhouette {
		width: 100%;
		height: 100%;
	}
	.silhouette path {
		fill: var(--nj-ink);
		stroke: var(--nj-hi);
		stroke-width: 2.5;
		filter: drop-shadow(5px 5px 0 var(--nj-accent));
	}
	.speech {
		justify-self: stretch;
	}
	.speech :global(.nj-speech__card) {
		padding: 30px 24px 18px 22px;
	}
	.line {
		margin: 0;
		font: 700 17px/1.35 var(--nj-font-body);
	}
	.note {
		margin: 8px 0 0;
		color: var(--nj-ink);
		font: 600 14px/1.35 var(--nj-font-body);
		opacity: 0.75;
	}
	.compact {
		grid-template-columns: 64px 1fr;
		align-items: end;
		gap: 10px;
		justify-items: stretch;
	}
	.compact .art {
		width: 64px;
		height: 76px;
		margin: 0;
	}
	.compact .speech :global(.nj-speech) {
		filter: drop-shadow(-4px 4px 0 var(--nj-ink)) drop-shadow(6px 6px 0 var(--nj-hi));
	}
	.compact .speech :global(.nj-speech__card) {
		padding: 22px 16px 12px 16px;
	}
	.compact .speech :global(.nj-speech__tag b),
	.compact .speech :global(.nj-speech__tag span) {
		font-size: 12px;
	}
	.compact .line {
		font-size: 15px;
	}
	.compact .note {
		font-size: 13px;
		margin-top: 4px;
	}
</style>
