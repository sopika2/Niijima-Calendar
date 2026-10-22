<script lang="ts">
	import { Bands } from '@niijima/design/svelte';
	import { goto } from '$app/navigation';
	import DayStamp from '$lib/components/DayStamp.svelte';
	import DayTimeline from '$lib/components/DayTimeline.svelte';
	import { addDays, formatDate, minutesOf, monthOf } from '$lib/dates';
	import { openNew, openOccurrence } from '$lib/editor.svelte';
	import { swipe } from '$lib/swipe';
	import type { Occurrence } from '$lib/types';
	import { zonedParts } from '$lib/zone';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const prev = $derived(`/day/${addDays(data.date, -1)}`);
	const next = $derived(`/day/${addDays(data.date, 1)}`);

	let clock = $state(Date.now());
	onMount(() => {
		// Bring the current time (today) or the first timed event into view.
		const target =
			document.querySelector<HTMLElement>('.now') ?? document.querySelector<HTMLElement>('.block');
		if (target && target.getBoundingClientRect().top > window.innerHeight * 0.7) {
			window.scrollTo({
				top: window.scrollY + target.getBoundingClientRect().top - window.innerHeight / 3
			});
		}
		const timer = setInterval(() => (clock = Date.now()), 60_000);
		return () => clearInterval(timer);
	});
	const now = $derived.by(() => {
		const parts = zonedParts(clock, data.timeZone);
		return parts.date === data.date ? minutesOf(parts.time) : null;
	});

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
		if (event.key === 'ArrowLeft') goto(prev);
		else if (event.key === 'ArrowRight') goto(next);
		else if (event.key === 't') goto(`/day/${data.today}`);
	}
</script>

<svelte:window onkeydown={keys} />
<svelte:head><title>{formatDate(data.date)} · Niijima Calendar</title></svelte:head>

<div class="page">
	<Bands ghost={formatDate(data.date).slice(0, 3)} />
	<div class="layout" use:swipe={{ left: () => goto(next), right: () => goto(prev) }}>
		<div class="bar">
			<div class="stamp">
				<DayStamp date={data.date} size="clamp(44px, 9vw, 72px)" />
				<p class="long">
					{formatDate(data.date, 'full')}{#if data.date === data.today}<span class="today"
							>Today</span
						>{/if}
				</p>
			</div>
			<nav class="nav" aria-label="Days">
				<a class="icon-btn" href={prev} aria-label="Previous day"><i class="arrow back"></i></a>
				<a class="icon-btn" href="/day/{data.today}">Today</a>
				<a class="icon-btn" href={next} aria-label="Next day"><i class="arrow"></i></a>
				<a class="icon-btn" href="/month/{monthOf(data.date)}?d={data.date}">Month</a>
			</nav>
		</div>
		<section class="sheet" aria-label="Schedule">
			{#if data.occurrences.length === 0}
				<p class="quiet">Nothing on. Tap an hour to add something.</p>
			{/if}
			<DayTimeline
				date={data.date}
				occurrences={data.occurrences}
				persona={data.persona}
				{now}
				onopen={open}
				onnew={(time) => openNew(data.date, time)}
			/>
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
		gap: 22px;
		width: min(900px, 100%);
		margin: 0 auto;
		padding: 24px clamp(16px, 3vw, 40px);
		touch-action: pan-y;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
	}
	.stamp {
		display: grid;
		justify-items: start;
		gap: 22px;
	}
	.long {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
		font: 700 18px/1.2 var(--nj-font-body);
	}
	.today {
		padding: 3px 7px 2px;
		background: var(--nj-accent);
		font: 400 14px/1 var(--nj-font-display);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.nav {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.sheet {
		padding: 16px 16px 20px;
		background: color-mix(in srgb, var(--nj-ink) 88%, transparent);
		box-shadow: 8px 8px 0 var(--nj-accent);
	}
	.quiet {
		margin: 0 0 12px;
		color: var(--nj-text-muted);
		font: 700 17px/1.3 var(--nj-font-body);
	}
	@media (max-width: 760px) {
		.layout {
			padding: 14px 16px;
			gap: 16px;
		}
		.sheet {
			padding: 12px 10px 16px 8px;
		}
	}
</style>
