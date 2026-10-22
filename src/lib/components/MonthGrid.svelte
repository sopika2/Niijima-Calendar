<script lang="ts">
	/**
	 * The month, like the in-game calendar: big slanted day numbers, a weekday plate on each day,
	 * today in thief red. Events show as chips on a computer and as dots on a phone, in the
	 * colour of whose they are; imported ones are hollow.
	 */
	import { burstPoints } from '@niijima/design';
	import { formatDate, monthOf, parseDate, weekdayOf, WEEKDAY_SHORT } from '$lib/dates';
	import type { Occurrence } from '$lib/types';

	interface Props {
		weeks: string[][];
		month: string;
		today: string;
		selected: string;
		days: Map<string, Occurrence[]>;
		onselect: (date: string) => void;
		onopen: (occurrence: Occurrence) => void;
		onnew: (date: string) => void;
	}

	let { weeks, month, today, selected, days, onselect, onopen, onnew }: Props = $props();
	const MAX_CHIPS = 3;
	const todayBurst = burstPoints('today', 11, 49, 34);

	function label(date: string, count: number) {
		const when = `${formatDate(date, 'long')}${date === today ? ', today' : ''}`;
		return count === 0
			? `${when}, nothing on`
			: `${when}, ${count} ${count === 1 ? 'event' : 'events'}`;
	}

	function keys(event: KeyboardEvent, date: string) {
		if (event.key === 'Enter' && event.shiftKey) {
			event.preventDefault();
			onnew(date);
		}
	}
</script>

<div class="grid" role="grid" aria-label="Month">
	<div class="head" role="row">
		{#each weeks[0]! as date (date)}
			{@const weekday = weekdayOf(date)}
			<span class="wd" class:sun={weekday === 0} class:sat={weekday === 6} role="columnheader">
				{WEEKDAY_SHORT[weekday]}
			</span>
		{/each}
	</div>
	{#each weeks as week (week[0])}
		<div class="week" role="row">
			{#each week as date (date)}
				{@const list = days.get(date) ?? []}
				{@const weekday = weekdayOf(date)}
				<div
					class="cell"
					class:out={monthOf(date) !== month}
					class:today={date === today}
					class:selected={date === selected}
					class:past={date < today}
					role="gridcell"
					aria-selected={date === selected}
				>
					<button
						type="button"
						class="hit"
						aria-label={label(date, list.length)}
						onclick={() => onselect(date)}
						ondblclick={() => onnew(date)}
						onkeydown={(event) => keys(event, date)}
					></button>
					<span class="num" class:sun={weekday === 0} class:sat={weekday === 6} aria-hidden="true">
						{#if date === today}<svg class="burst" viewBox="0 0 100 100"
								><polygon points={todayBurst} /></svg
							>{/if}
						{parseDate(date).day}
					</span>
					<span
						class="plate"
						class:sun={weekday === 0}
						class:sat={weekday === 6}
						aria-hidden="true"
					>
						{date === today ? 'TODAY' : WEEKDAY_SHORT[weekday]}
					</span>
					{#if list.length > 0}
						<ul class="chips">
							{#each list.slice(0, MAX_CHIPS) as occurrence (occurrence.key)}
								<li>
									<button
										type="button"
										class="chip"
										class:imported={!!occurrence.source}
										data-owner={occurrence.owner}
										onclick={() => onopen(occurrence)}
									>
										{#if !occurrence.allDay && occurrence.startDate === date}<b
												>{occurrence.startTime}</b
											>{/if}
										{occurrence.title}
									</button>
								</li>
							{/each}
							{#if list.length > MAX_CHIPS}
								<li class="more">+{list.length - MAX_CHIPS} more</li>
							{/if}
						</ul>
						<span class="dots" aria-hidden="true">
							{#each list.slice(0, 4) as occurrence (occurrence.key)}
								<i data-owner={occurrence.owner} class:imported={!!occurrence.source}></i>
							{/each}
							{#if list.length > 4}<em>+</em>{/if}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		gap: 6px;
	}
	.head,
	.week {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 6px;
	}
	.wd {
		justify-self: start;
		padding: 4px 8px 2px;
		background: var(--nj-paper);
		color: var(--nj-ink);
		font: 400 15px/1 var(--nj-font-display);
		letter-spacing: 0.08em;
		transform: rotate(-4deg);
		clip-path: polygon(0 8%, 100% 0, 94% 100%, 4% 92%);
	}
	.wd.sun {
		background: var(--nj-accent);
		color: var(--nj-paper);
	}
	.wd.sat {
		background: var(--nj-makoto-cyan);
	}

	.cell {
		position: relative;
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto 1fr;
		align-content: start;
		gap: 2px 6px;
		min-height: 118px;
		padding: 6px 6px 8px;
		background: var(--nj-surface);
		clip-path: polygon(0 0, 100% 2%, 98% 100%, 1% 98%);
		transition: background-color 0.08s;
	}
	.cell:hover {
		background: var(--nj-surface-raised);
	}
	.hit {
		position: absolute;
		inset: 0;
		z-index: 0;
		width: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.hit:focus-visible {
		outline: 3px solid var(--nj-focus);
		outline-offset: -3px;
	}
	.num {
		position: relative;
		z-index: 1;
		isolation: isolate;
		padding-left: 2px;
		color: var(--nj-paper);
		font: 400 36px/0.9 var(--nj-font-display);
		text-shadow: 3px 3px 0 var(--nj-ink);
		transform: skewX(-8deg);
		pointer-events: none;
	}
	.num.sun {
		color: var(--nj-red-text);
	}
	.num.sat {
		color: var(--nj-makoto-cyan);
	}
	.plate {
		position: relative;
		z-index: 1;
		align-self: start;
		justify-self: start;
		margin-top: 2px;
		padding: 3px 5px 1px;
		background: var(--nj-ink);
		color: var(--nj-text-muted);
		font: 400 11px/1 var(--nj-font-display);
		letter-spacing: 0.1em;
		transform: rotate(8deg);
		pointer-events: none;
	}
	.plate.sun {
		color: var(--nj-red-text);
	}
	.plate.sat {
		color: var(--nj-makoto-cyan);
	}
	.out {
		opacity: 0.38;
	}
	.past:not(.today) .num {
		color: var(--nj-text-muted);
	}

	.today {
		background: var(--nj-accent);
		opacity: 1;
	}
	.today:hover {
		background: var(--nj-accent);
	}
	.today .num {
		color: var(--nj-paper);
	}
	.burst {
		position: absolute;
		z-index: -1;
		left: -14px;
		top: -16px;
		width: 66px;
		height: 66px;
	}
	.burst polygon {
		fill: var(--nj-ink);
	}
	.today .plate {
		background: var(--nj-paper);
		color: var(--nj-ink);
	}
	.selected {
		box-shadow: inset 0 0 0 3px var(--nj-hi);
		clip-path: none;
	}
	.selected::after {
		content: '';
		position: absolute;
		right: 0;
		bottom: 0;
		width: 0;
		height: 0;
		border-left: 18px solid transparent;
		border-bottom: 18px solid var(--nj-hi);
		pointer-events: none;
	}

	.chips {
		grid-column: 1 / -1;
		display: grid;
		gap: 3px;
		align-content: start;
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
		min-width: 0;
	}
	.chips li {
		min-width: 0;
	}
	.chip {
		position: relative;
		z-index: 1;
		display: block;
		width: 100%;
		overflow: hidden;
		padding: 3px 6px 2px 8px;
		border: 0;
		border-left: 4px solid var(--own);
		background: var(--nj-ink);
		color: var(--nj-text);
		font: 600 13px/1.25 var(--nj-font-body);
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}
	.chip b {
		color: var(--own);
		font-weight: 800;
	}
	.chip:hover,
	.chip:focus-visible {
		background: var(--nj-paper);
		color: var(--nj-ink);
	}
	.chip:hover b {
		color: var(--nj-ink);
	}
	.chip.imported {
		border-left-style: dashed;
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--nj-text-muted);
	}
	.today .chip.imported {
		background: var(--nj-ink);
	}
	.more {
		position: relative;
		z-index: 0;
		padding-left: 4px;
		color: var(--nj-text-muted);
		font: 700 12px/1.2 var(--nj-font-body);
		pointer-events: none;
	}
	.today .more {
		color: var(--nj-paper);
	}
	.dots {
		display: none;
	}

	@media (max-width: 760px) {
		.grid,
		.head,
		.week {
			gap: 4px;
		}
		.wd {
			justify-self: center;
			padding: 3px 4px 1px;
			font-size: 12px;
		}
		.cell {
			grid-template-columns: 1fr;
			justify-items: center;
			min-height: 58px;
			padding: 5px 2px 6px;
		}
		.num {
			padding: 0;
			font-size: 24px;
			text-shadow: 2px 2px 0 var(--nj-ink);
		}
		.burst {
			left: -12px;
			top: -12px;
			width: 46px;
			height: 46px;
		}
		.plate,
		.chips {
			display: none;
		}
		.dots {
			position: relative;
			z-index: 0;
			display: flex;
			align-items: center;
			gap: 3px;
			margin-top: 5px;
			pointer-events: none;
		}
		.dots i {
			width: 7px;
			height: 7px;
			background: var(--own);
			transform: rotate(45deg);
		}
		.dots i.imported {
			background: transparent;
			box-shadow: inset 0 0 0 1.5px var(--own);
		}
		.today .dots i {
			box-shadow: 0 0 0 1.5px var(--nj-ink);
		}
		.dots em {
			color: var(--nj-text-muted);
			font: 800 11px/1 var(--nj-font-body);
			font-style: normal;
		}
	}
</style>
