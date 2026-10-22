<script lang="ts">
	/** One day's events as a list, or an invitation to add one. */
	import type { Occurrence } from '$lib/types';
	import EventRow from './EventRow.svelte';

	interface Props {
		date: string;
		occurrences: Occurrence[];
		persona: 'makoto' | 'sae';
		onopen: (occurrence: Occurrence) => void;
		onnew?: () => void;
	}

	let { date, occurrences, persona, onopen, onnew }: Props = $props();
</script>

{#if occurrences.length === 0}
	<div class="empty">
		<p>Nothing on.</p>
		{#if onnew}<button type="button" class="nj-btn nj-btn--small" onclick={onnew}
				>Add something<i class="nj-btn__arrow" aria-hidden="true"></i></button
			>{/if}
	</div>
{:else}
	<ul class="list">
		{#each occurrences as occurrence (occurrence.key)}
			<li><EventRow {occurrence} {date} {persona} {onopen} /></li>
		{/each}
	</ul>
	{#if onnew}
		<button type="button" class="add" onclick={onnew}>+ Add on this day</button>
	{/if}
{/if}

<style>
	.list {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.empty {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 4px 8px;
	}
	.empty p {
		margin: 0;
		color: var(--nj-text-muted);
		font: 700 17px/1.3 var(--nj-font-body);
	}
	.add {
		justify-self: start;
		min-height: 44px;
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--nj-hi);
		font: 700 15px/1 var(--nj-font-body);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.add:hover {
		text-decoration: underline;
	}
</style>
