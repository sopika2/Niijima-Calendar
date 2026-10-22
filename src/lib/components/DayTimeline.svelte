<script lang="ts">
	/**
	 * One day hour by hour: all-day events on top, timed ones as blocks on the hours, side by
	 * side where they overlap, and a red line at the current time today.
	 */
	import { minutesOf } from '$lib/dates';
	import { OWNER_LABELS, type Occurrence } from '$lib/types';
	import { timeRange } from '$lib/ui';

	interface Props {
		date: string;
		occurrences: Occurrence[];
		persona: 'makoto' | 'sae';
		/** Minutes since midnight now, when the day is today. */
		now: number | null;
		onopen: (occurrence: Occurrence) => void;
		onnew: (time: string) => void;
	}

	let { date, occurrences, persona, now, onopen, onnew }: Props = $props();
	const HOUR = 56;

	const allDay = $derived(
		occurrences.filter((o) => o.allDay || (o.startDate < date && o.endDate > date))
	);

	interface Block {
		occurrence: Occurrence;
		start: number;
		end: number;
		column: number;
		columns: number;
	}

	const blocks = $derived.by((): Block[] => {
		const timed = occurrences
			.filter((o) => !allDay.includes(o))
			.map((occurrence) => ({
				occurrence,
				start: occurrence.startDate < date ? 0 : minutesOf(occurrence.startTime!),
				end: occurrence.endDate > date ? 1440 : minutesOf(occurrence.endTime!),
				column: 0,
				columns: 1
			}))
			.map((b) => ({ ...b, end: Math.max(b.end, b.start + 20) }))
			.sort((a, b) => a.start - b.start || b.end - a.end);
		// Overlapping events share the width: greedy columns within each cluster.
		let cluster: Block[] = [];
		let clusterEnd = -1;
		const finish = () => {
			const columns = Math.max(1, ...cluster.map((b) => b.column + 1));
			for (const block of cluster) block.columns = columns;
			cluster = [];
		};
		for (const block of timed) {
			if (block.start >= clusterEnd) {
				finish();
				clusterEnd = -1;
			}
			const used = new Set(cluster.filter((b) => b.end > block.start).map((b) => b.column));
			let column = 0;
			while (used.has(column)) column++;
			block.column = column;
			cluster.push(block);
			clusterEnd = Math.max(clusterEnd, block.end);
		}
		finish();
		return timed;
	});

	const firstHour = $derived(
		Math.min(
			7,
			...blocks.map((b) => Math.floor(b.start / 60)),
			now !== null ? Math.floor(now / 60) : 24
		)
	);
	const lastHour = $derived(
		Math.max(
			22,
			...blocks.map((b) => Math.ceil(b.end / 60)),
			now !== null ? Math.ceil(now / 60) : 0
		)
	);
	const hours = $derived(
		Array.from({ length: Math.min(24, lastHour) - firstHour }, (_, i) => firstHour + i)
	);
	const top = (minutes: number) => ((minutes - firstHour * 60) / 60) * HOUR;
	const pad = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
</script>

{#if allDay.length > 0}
	<ul class="allday" aria-label="All day">
		{#each allDay as occurrence (occurrence.key)}
			<li>
				<button
					type="button"
					class="pill"
					class:imported={!!occurrence.source}
					data-owner={occurrence.owner}
					onclick={() => onopen(occurrence)}
				>
					{occurrence.title}
					{#if occurrence.owner !== persona}<span class="who">{OWNER_LABELS[occurrence.owner]}</span
						>{/if}
				</button>
			</li>
		{/each}
	</ul>
{/if}

<div class="timeline" style="height:{hours.length * HOUR}px">
	{#each hours as hour (hour)}
		<button
			type="button"
			class="hour"
			style="top:{top(hour * 60)}px;height:{HOUR}px"
			aria-label="New event at {pad(hour)}"
			onclick={() => onnew(pad(hour))}
		>
			<span>{pad(hour)}</span>
		</button>
	{/each}
	<div class="lane">
		{#each blocks as block (block.occurrence.key)}
			<button
				type="button"
				class="block"
				class:imported={!!block.occurrence.source}
				class:short={block.end - block.start < 45}
				data-owner={block.occurrence.owner}
				style="top:{top(block.start)}px;height:{Math.max(
					22,
					top(block.end) - top(block.start) - 3
				)}px;left:{(block.column / block.columns) * 100}%;width:calc({100 / block.columns}% - 4px)"
				onclick={() => onopen(block.occurrence)}
			>
				<b>{block.occurrence.title}</b>
				<span
					>{timeRange(block.occurrence, date)}{block.occurrence.location
						? ` · ${block.occurrence.location}`
						: ''}</span
				>
			</button>
		{/each}
		{#if now !== null && now >= firstHour * 60}
			<div class="now" style="top:{top(now)}px" aria-hidden="true"></div>
		{/if}
	</div>
</div>

<style>
	.allday {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 0 0 16px;
		padding: 0;
		list-style: none;
	}
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 6px 14px;
		border: 0;
		background: var(--own);
		color: var(--nj-ink);
		font: 700 16px/1.2 var(--nj-font-body);
		cursor: pointer;
		clip-path: polygon(3% 0, 100% 4%, 97% 100%, 0 96%);
	}
	.pill.imported {
		background: var(--nj-ink);
		color: var(--nj-text);
		box-shadow: inset 0 0 0 2px var(--own);
		clip-path: none;
		border: 1px dashed var(--own);
	}
	.pill .who {
		background: var(--nj-ink);
		color: var(--nj-paper);
	}
	.timeline {
		position: relative;
	}
	.hour {
		position: absolute;
		left: 0;
		right: 0;
		display: block;
		padding: 0;
		border: 0;
		border-top: 1px solid var(--nj-surface-raised);
		background: none;
		text-align: left;
		cursor: copy;
	}
	.hour:hover {
		background: color-mix(in srgb, var(--nj-surface) 60%, transparent);
	}
	.hour span {
		display: inline-block;
		width: 58px;
		padding: 4px 0 0 2px;
		color: var(--nj-text-muted);
		font: 400 15px/1 var(--nj-font-display);
		letter-spacing: 0.06em;
	}
	.lane {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 62px;
		right: 0;
		pointer-events: none;
	}
	.block {
		position: absolute;
		display: grid;
		align-content: start;
		gap: 2px;
		overflow: hidden;
		padding: 5px 8px 4px 12px;
		border: 0;
		border-left: 6px solid var(--own);
		background: var(--nj-surface-raised);
		color: var(--nj-text);
		text-align: left;
		cursor: pointer;
		pointer-events: auto;
		box-shadow: 3px 3px 0 var(--nj-ink);
		transition: transform var(--nj-fast) var(--nj-snap);
	}
	.block:hover,
	.block:focus-visible {
		z-index: 2;
		background: var(--nj-paper);
		color: var(--nj-ink);
		transform: rotate(-1deg) scale(1.02);
	}
	.block.imported {
		border-left-style: dashed;
		background: repeating-linear-gradient(
			-45deg,
			var(--nj-surface) 0 10px,
			var(--nj-ink) 10px 12px
		);
	}
	.block b {
		overflow: hidden;
		font: 700 16px/1.2 var(--nj-font-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.block span {
		overflow: hidden;
		color: inherit;
		font: 500 13px/1.25 var(--nj-font-body);
		opacity: 0.8;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.block.short {
		grid-auto-flow: column;
		justify-content: start;
		align-items: center;
		gap: 8px;
		padding-block: 2px;
	}
	.now {
		position: absolute;
		left: -10px;
		right: 0;
		height: 3px;
		background: var(--nj-accent);
		box-shadow: 0 0 0 1px var(--nj-ink);
	}
	.now::before {
		content: '';
		position: absolute;
		left: -6px;
		top: -6px;
		width: 14px;
		height: 14px;
		background: var(--nj-accent);
		transform: rotate(45deg);
	}
</style>
