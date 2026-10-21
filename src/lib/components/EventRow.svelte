<script lang="ts">
	/** One event in a list: time, title, place, and whose it is when it isn't hers. */
	import { OWNER_LABELS, type Occurrence } from '$lib/types';
	import { timeRange } from '$lib/ui';

	interface Props {
		occurrence: Occurrence;
		/** The day the list is for, so overnight events read "From 22:00" / "Until 02:00". */
		date: string;
		persona: 'makoto' | 'sae';
		onopen: (occurrence: Occurrence) => void;
	}

	let { occurrence, date, persona, onopen }: Props = $props();
	const time = $derived(timeRange(occurrence, date));
</script>

<button
	type="button"
	class="row"
	class:imported={!!occurrence.source}
	data-owner={occurrence.owner}
	onclick={() => onopen(occurrence)}
>
	<span class="time" class:allday={time === 'All day'}>{time}</span>
	<span class="body">
		<span class="title">{occurrence.title}</span>
		{#if occurrence.location}<span class="where">{occurrence.location}</span>{/if}
	</span>
	<span class="tags">
		{#if occurrence.owner !== persona}<span class="who">{OWNER_LABELS[occurrence.owner]}</span>{/if}
		{#if occurrence.source}<span class="via">{occurrence.source}</span>{/if}
		{#if occurrence.repeat !== 'none'}<span class="repeat" title="Repeats" aria-label="Repeats"
				>↻</span
			>{/if}
	</span>
</button>

<style>
	.row {
		position: relative;
		display: grid;
		grid-template-columns: 7.2em 1fr auto;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 52px;
		padding: 8px 12px 8px 18px;
		border: 0;
		background: var(--nj-surface);
		color: var(--nj-text);
		text-align: left;
		cursor: pointer;
		clip-path: polygon(0 0, 100% 0, 99% 100%, 0.6% 100%);
		transition:
			transform var(--nj-fast) var(--nj-snap),
			background-color 0.06s;
	}
	.row::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 7px;
		background: var(--own);
		transform: skewX(-8deg);
	}
	.row:hover,
	.row:focus-visible {
		background: var(--nj-surface-raised);
		transform: translateX(4px);
	}
	.imported {
		background: repeating-linear-gradient(
			-45deg,
			var(--nj-surface) 0 10px,
			var(--nj-ink) 10px 12px
		);
	}
	.imported::before {
		background: repeating-linear-gradient(var(--own) 0 6px, transparent 6px 10px);
	}
	.time {
		font: 400 18px/1.1 var(--nj-font-display);
		letter-spacing: 0.04em;
		white-space: nowrap;
	}
	.time.allday {
		justify-self: start;
		padding: 3px 7px 2px;
		background: var(--own);
		color: var(--nj-ink);
		font-size: 14px;
		transform: rotate(-3deg);
	}
	.body {
		display: grid;
		min-width: 0;
	}
	.title {
		overflow: hidden;
		font: 700 18px/1.25 var(--nj-font-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.where {
		overflow: hidden;
		color: var(--nj-text-muted);
		font: 500 14px/1.3 var(--nj-font-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 6px;
		max-width: 9em;
	}
	.via {
		max-width: 8em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.repeat {
		color: var(--nj-text-muted);
		font-size: 16px;
	}
	@media (max-width: 480px) {
		.row {
			grid-template-columns: 5.4em 1fr auto;
			gap: 10px;
			padding-left: 16px;
		}
		.time {
			font-size: 16px;
			white-space: normal;
		}
		.title {
			font-size: 17px;
		}
		.tags {
			max-width: 6em;
		}
	}
</style>
