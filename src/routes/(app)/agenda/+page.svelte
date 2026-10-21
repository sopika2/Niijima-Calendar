<script lang="ts">
	import { Bands, DateHud } from '@niijima/design/svelte';
	import { goto } from '$app/navigation';
	import EventRow from '$lib/components/EventRow.svelte';
	import HostCard from '$lib/components/HostCard.svelte';
	import { addDays, formatDate, MONTH_LONG, parseDate, weekdayOf, WEEKDAY_SHORT } from '$lib/dates';
	import { openNew, openOccurrence } from '$lib/editor.svelte';
	import type { Occurrence } from '$lib/types';
	import { byDay } from '$lib/ui';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const groups = $derived.by(() => {
		const days = byDay(data.occurrences, data.from, data.to);
		const list = [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
		if (!days.has(data.from)) list.unshift([data.from, []]);
		return list;
	});

	const note = $derived.by(() => {
		const today = groups[0]?.[1] ?? [];
		if (today.length === 0) return 'Nothing on today.';
		const nowTime = new Date().toLocaleTimeString('en-GB', {
			timeZone: data.timeZone,
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		});
		const next = today.find(
			(o) => !o.allDay && o.startDate === data.from && (o.startTime ?? '') >= nowTime
		);
		const count = `${today.length} ${today.length === 1 ? 'thing' : 'things'} today.`;
		return next ? `${count} Next: ${next.title} at ${next.startTime}.` : count;
	});

	function label(date: string) {
		if (date === data.today) return 'Today';
		if (date === addDays(data.today, 1)) return 'Tomorrow';
		return null;
	}

	function open(occurrence: Occurrence) {
		openOccurrence(
			occurrence,
			occurrence.eventId ? (data.series[occurrence.eventId] ?? null) : null
		);
	}

	function keys(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable], dialog')) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === 't') window.scrollTo({ top: 0, behavior: 'smooth' });
		else if (event.key === 'ArrowRight') goto(`/day/${data.today}`);
	}
</script>

<svelte:window onkeydown={keys} />
<svelte:head><title>Agenda · Niijima Calendar</title></svelte:head>

<div class="page">
	<Bands ghost="Agenda" />
	<div class="layout">
		<aside class="intro">
			<div class="hud"><DateHud timeZone={data.timeZone} size="58px" /></div>
			<div class="host-wide"><HostCard host={data.host} {note} /></div>
			<div class="host-small"><HostCard host={data.host} {note} compact /></div>
		</aside>

		<section class="agenda" aria-label="The next 60 days">
			<p class="kicker range">
				{formatDate(data.from)} – {formatDate(data.to)} · {data.occurrences.length}
				{data.occurrences.length === 1 ? 'event' : 'events'}
			</p>
			{#each groups as [date, items] (date)}
				{@const parts = parseDate(date)}
				{@const weekday = weekdayOf(date)}
				<section class="group" class:today={date === data.today} aria-labelledby="d-{date}">
					<a class="date" href="/day/{date}" id="d-{date}" aria-label={formatDate(date, 'full')}>
						<span class="num">{parts.day}</span>
						<span class="meta">
							<span class="wd" class:sun={weekday === 0} class:sat={weekday === 6}
								>{WEEKDAY_SHORT[weekday]}</span
							>
							<span class="mon">{MONTH_LONG[parts.month - 1]!.slice(0, 3)}</span>
						</span>
						{#if label(date)}<span class="tag">{label(date)}</span>{/if}
					</a>
					{#if items.length === 0}
						<div class="none">
							<p>Nothing on today.</p>
							<button type="button" class="nj-btn nj-btn--small" onclick={() => openNew(data.today)}
								>Add something<i class="nj-btn__arrow" aria-hidden="true"></i></button
							>
						</div>
					{:else}
						<ul class="list">
							{#each items as occurrence (occurrence.key)}
								<li>
									<EventRow {occurrence} {date} persona={data.persona} onopen={open} />
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
			{#if data.occurrences.length === 0}
				<p class="quiet">The next 60 days are clear. Press <b>New</b> to plan something.</p>
			{/if}
		</section>
	</div>
</div>

<style>
	.page {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		min-height: 100%;
	}
	.layout {
		display: grid;
		grid-template-columns: 340px minmax(0, 760px);
		justify-content: center;
		gap: 40px;
		padding: 28px clamp(16px, 3vw, 40px);
	}
	.intro {
		position: sticky;
		top: 100px;
		align-self: start;
		display: grid;
		gap: 22px;
	}
	.hud {
		padding: 30px 0 0 40px;
	}
	.host-small {
		display: none;
	}
	.agenda {
		display: grid;
		align-content: start;
		gap: 22px;
		min-width: 0;
	}
	.range {
		margin-bottom: -6px;
	}
	.group {
		display: grid;
		grid-template-columns: 92px minmax(0, 1fr);
		gap: 14px;
		align-items: start;
	}
	.date {
		position: relative;
		display: grid;
		grid-template-columns: auto auto;
		align-items: center;
		justify-content: start;
		gap: 0 6px;
		color: var(--nj-paper) !important;
		text-decoration: none;
		transform: rotate(-4deg);
	}
	.num {
		font: 400 48px/0.9 var(--nj-font-display);
		text-shadow: 3px 3px 0 var(--nj-accent);
	}
	.meta {
		display: grid;
		gap: 3px;
	}
	.wd {
		padding: 2px 5px 1px;
		background: var(--nj-paper);
		color: var(--nj-ink);
		font: 400 13px/1 var(--nj-font-display);
		letter-spacing: 0.08em;
	}
	.wd.sun {
		background: var(--nj-accent);
		color: var(--nj-paper);
	}
	.wd.sat {
		background: var(--nj-makoto-cyan);
	}
	.mon {
		color: var(--nj-text-muted);
		font: 700 12px/1 var(--nj-font-body);
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.tag {
		grid-column: 1 / -1;
		justify-self: start;
		margin-top: 6px;
		padding: 3px 7px 2px;
		background: var(--nj-hi);
		color: var(--nj-hi-ink);
		font: 400 13px/1 var(--nj-font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.today .date .num {
		text-shadow:
			3px 3px 0 var(--nj-ink),
			6px 6px 0 var(--nj-accent);
	}
	.today .tag {
		background: var(--nj-accent);
		color: var(--nj-paper);
	}
	.list {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.none {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 52px;
		padding: 6px 12px;
		background: var(--nj-surface);
	}
	.none p,
	.quiet {
		margin: 0;
		color: var(--nj-text-muted);
		font: 700 17px/1.3 var(--nj-font-body);
	}
	@media (max-width: 1000px) {
		.layout {
			grid-template-columns: minmax(0, 1fr);
			gap: 18px;
			padding: 14px 16px 16px;
		}
		.intro {
			position: static;
		}
		.hud,
		.host-wide {
			display: none;
		}
		.host-small {
			display: block;
			padding-top: 14px;
		}
	}
	@media (max-width: 480px) {
		.group {
			grid-template-columns: 1fr;
			gap: 8px;
		}
		.date {
			grid-template-columns: auto auto auto;
			gap: 8px;
			transform: rotate(-2deg);
		}
		.num {
			font-size: 38px;
		}
		.meta {
			grid-auto-flow: column;
			align-items: center;
			gap: 6px;
		}
		.tag {
			grid-column: auto;
			margin-top: 0;
		}
	}
</style>
