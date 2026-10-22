<script lang="ts">
	import { Bands, DateHud, Plate, Ransom } from '@niijima/design/svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import DayList from '$lib/components/DayList.svelte';
	import HostCard from '$lib/components/HostCard.svelte';
	import MonthGrid from '$lib/components/MonthGrid.svelte';
	import { addMonths, formatDate, formatMonth, isDate, monthOf, MONTH_LONG } from '$lib/dates';
	import { openNew, openOccurrence } from '$lib/editor.svelte';
	import { swipe } from '$lib/swipe';
	import type { Occurrence } from '$lib/types';
	import { byDay } from '$lib/ui';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const days = $derived(byDay(data.occurrences, data.from, data.to));
	const selected = $derived.by(() => {
		const asked = page.url.searchParams.get('d');
		if (isDate(asked) && monthOf(asked) === data.month) return asked;
		return monthOf(data.today) === data.month ? data.today : `${data.month}-01`;
	});
	const prev = $derived(`/month/${addMonths(data.month, -1)}`);
	const next = $derived(`/month/${addMonths(data.month, 1)}`);
	const monthName = $derived(MONTH_LONG[Number(data.month.slice(5, 7)) - 1]!.toUpperCase());
	const todayCount = $derived((days.get(data.today) ?? []).length);

	function select(date: string) {
		if (monthOf(date) !== data.month) {
			goto(`/month/${monthOf(date)}?d=${date}`);
			return;
		}
		goto(`?d=${date}`, { replaceState: true, noScroll: true, keepFocus: true });
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
		if (event.key === 'ArrowLeft') goto(prev);
		else if (event.key === 'ArrowRight') goto(next);
		else if (event.key === 't') goto(`/month/${monthOf(data.today)}?d=${data.today}`);
	}
</script>

<svelte:window onkeydown={keys} />
<svelte:head><title>{formatMonth(data.month)} · Niijima Calendar</title></svelte:head>

<div class="page">
	<Bands ghost={monthName} />
	<div class="layout">
		<section class="main" use:swipe={{ left: () => goto(next), right: () => goto(prev) }}>
			<div class="bar">
				<div class="title">
					<Ransom as="h1" text={monthName} size="clamp(34px, 6vw, 64px)" seed={data.month} />
					<Plate variant="hi">{data.month.slice(0, 4)}</Plate>
				</div>
				<nav class="nav" aria-label="Months">
					<a class="icon-btn" href={prev} aria-label="Previous month"><i class="arrow back"></i></a>
					<a class="icon-btn" href="/month/{monthOf(data.today)}?d={data.today}">Today</a>
					<a class="icon-btn" href={next} aria-label="Next month"><i class="arrow"></i></a>
				</nav>
			</div>
			<MonthGrid
				weeks={data.weeks}
				month={data.month}
				today={data.today}
				{selected}
				{days}
				onselect={select}
				onopen={open}
				onnew={(date) => openNew(date)}
			/>
		</section>

		<aside class="rail">
			<div class="hud"><DateHud timeZone={data.timeZone} size="64px" /></div>
			<div class="host">
				<HostCard
					host={data.host}
					note={monthOf(data.today) === data.month
						? todayCount === 0
							? 'Nothing on today.'
							: `${todayCount} ${todayCount === 1 ? 'thing' : 'things'} today.`
						: null}
				/>
			</div>
			<section class="day" aria-labelledby="day-title">
				<div class="day-head">
					<h2 id="day-title">{selected === data.today ? 'Today' : formatDate(selected, 'long')}</h2>
					<a class="icon-btn" href="/day/{selected}">Day view</a>
				</div>
				<DayList
					date={selected}
					occurrences={days.get(selected) ?? []}
					persona={data.persona}
					onopen={open}
					onnew={() => openNew(selected)}
				/>
			</section>
		</aside>
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
		grid-template-columns: minmax(0, 1fr) 360px;
		gap: 28px;
		padding: 24px clamp(16px, 3vw, 40px) 24px;
	}
	.main {
		min-width: 0;
		touch-action: pan-y;
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 20px;
		margin-bottom: 18px;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 14px;
		transform: rotate(-2deg);
	}
	.title :global(h1) {
		margin: 0;
	}
	.nav {
		display: flex;
		gap: 8px;
	}
	.rail {
		display: grid;
		align-content: start;
		gap: 22px;
		min-width: 0;
	}
	.hud {
		padding: 30px 0 0 40px;
	}
	.day {
		display: grid;
		gap: 12px;
		padding: 16px;
		background: color-mix(in srgb, var(--nj-ink) 85%, transparent);
		box-shadow: 6px 6px 0 var(--nj-accent);
	}
	.day-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.day-head h2 {
		margin: 0;
		font: 400 26px/1 var(--nj-font-display);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.day-head .icon-btn {
		font-size: 15px;
	}
	@media (max-width: 1100px) {
		.layout {
			grid-template-columns: 1fr;
		}
		.rail {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.hud,
		.host {
			display: none;
		}
		.day {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 760px) {
		.layout {
			gap: 18px;
			padding: 14px 16px 16px;
		}
		.bar {
			margin-bottom: 12px;
		}
		.nav .icon-btn {
			min-width: 44px;
		}
		.day {
			padding: 12px;
		}
	}
</style>
