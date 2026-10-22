<script lang="ts">
	import { PersonaSwitch, Wordmark } from '@niijima/design/svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import EventSheet from '$lib/components/EventSheet.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { isDate, monthOf } from '$lib/dates';
	import { editor, notify, openNew } from '$lib/editor.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	/** The day the views are looking at: the day page's, the month's selected day, or today. */
	const focus = $derived.by(() => {
		const day = page.params.date;
		if (isDate(day)) return day;
		const selected = page.url.searchParams.get('d');
		if (isDate(selected)) return selected;
		const month = page.params.month;
		if (month && month !== monthOf(data.today)) return `${month}-01`;
		return data.today;
	});

	const view = $derived(
		page.url.pathname.startsWith('/month')
			? 'month'
			: page.url.pathname.startsWith('/agenda')
				? 'agenda'
				: page.url.pathname.startsWith('/day')
					? 'day'
					: null
	);

	const tabs = $derived([
		{ id: 'month', label: 'Month', href: `/month/${monthOf(focus)}?d=${focus}` },
		{ id: 'agenda', label: 'Agenda', href: '/agenda' },
		{ id: 'day', label: 'Day', href: `/day/${focus}` }
	]);

	// Messages handed over by redirects (no-JavaScript saves).
	$effect(() => {
		const params = page.url.searchParams;
		if (params.has('saved')) notify('Saved.');
		if (params.has('deleted')) notify('Deleted.');
	});

	function shortcut(event: KeyboardEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable], dialog')) return;
		if (editor.open || event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === 'n') {
			event.preventDefault();
			openNew(view === 'agenda' ? data.today : focus);
		}
	}

	/** After saving, show the event if it landed outside what's on screen. */
	function afterSave(date: string) {
		if (view === 'month' && monthOf(date) !== page.params.month)
			goto(`/month/${monthOf(date)}?d=${date}`);
		else if (view === 'month')
			goto(`/month/${monthOf(date)}?d=${date}`, {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		else if (view === 'day' && date !== page.params.date) goto(`/day/${date}`);
	}
</script>

<svelte:window onkeydown={shortcut} />

<div class="app">
	<header class="top">
		<a class="brand" href="/" aria-label="Niijima Calendar, home">
			<Wordmark name="Calendar" kanji="新島暦" />
		</a>
		<nav class="tabs" aria-label="Views">
			{#each tabs as tab (tab.id)}
				<a href={tab.href} class="tab" aria-current={view === tab.id ? 'page' : undefined}
					>{tab.label}</a
				>
			{/each}
		</nav>
		<div class="persona">
			<PersonaSwitch value={data.persona} onchange={() => invalidateAll()} />
		</div>
		<button
			type="button"
			class="nj-btn nj-btn--red nj-btn--small new"
			onclick={() => openNew(view === 'agenda' ? data.today : focus)}
		>
			New<i class="nj-btn__arrow" aria-hidden="true"></i>
		</button>
	</header>

	<main class="main">
		{@render children()}
	</main>

	<footer class="foot">
		<a href="/sync">Sync &amp; subscribe</a>
		<a href="https://niijimasisters.com">niijimasisters.com</a>
		<span class="keys" aria-hidden="true"
			><kbd>←</kbd><kbd>→</kbd> move · <kbd>T</kbd> today · <kbd>N</kbd> new</span
		>
		{#if data.signedIn}
			<form method="POST" action="/auth/logout">
				<button type="submit" class="link">Sign out</button>
			</form>
		{/if}
	</footer>
</div>

<button
	type="button"
	class="fab"
	aria-label="New event"
	onclick={() => openNew(view === 'agenda' ? data.today : focus)}
	><span aria-hidden="true">+</span></button
>

<EventSheet
	persona={data.persona}
	today={data.today}
	timeZone={data.timeZone}
	weekStart={data.weekStart}
	onsaved={afterSave}
/>
<Toast />

<style>
	.app {
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-height: 100dvh;
	}
	.top {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 18px 28px;
		padding: 14px clamp(16px, 3vw, 40px) 12px;
		background: var(--nj-ink);
		box-shadow: 0 4px 0 var(--nj-accent);
	}
	.brand {
		flex: none;
		text-decoration: none;
	}
	.brand :global(.nj-wordmark) {
		box-shadow: 4px 4px 0 var(--nj-hi);
	}
	.tabs {
		display: flex;
		gap: 6px;
	}
	.tab {
		display: inline-grid;
		place-items: center;
		min-height: 44px;
		padding: 0 18px;
		background: var(--nj-surface);
		color: var(--nj-text-muted) !important;
		font: 400 20px/1 var(--nj-font-display);
		letter-spacing: 0.06em;
		text-decoration: none;
		text-transform: uppercase;
		clip-path: polygon(8% 0, 100% 0, 92% 100%, 0 100%);
		transition:
			transform var(--nj-fast) var(--nj-snap),
			color 0.06s;
	}
	.tab:hover {
		color: var(--nj-paper) !important;
		transform: scale(1.05);
	}
	.tab[aria-current='page'] {
		background: var(--nj-paper);
		color: var(--nj-ink) !important;
		transform: rotate(-3deg) scale(1.06);
		box-shadow: inset 0 -5px 0 var(--nj-accent);
	}
	.persona {
		margin-left: auto;
	}
	.persona :global(.nj-persona__opt) {
		min-height: 40px;
		font-size: 18px;
	}
	.main {
		position: relative;
		isolation: isolate;
		min-width: 0;
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 24px;
		padding: 18px clamp(16px, 3vw, 40px) calc(96px + env(safe-area-inset-bottom));
		color: var(--nj-text-muted);
		font: 600 14px/1.3 var(--nj-font-body);
		letter-spacing: 0.04em;
	}
	.foot a,
	.link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--nj-text-muted);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.foot a:hover,
	.link:hover {
		color: var(--nj-paper);
	}
	kbd {
		padding: 2px 6px;
		margin-right: 2px;
		background: var(--nj-surface-raised);
		color: var(--nj-paper);
		font: 700 12px/1.2 var(--nj-font-body);
	}
	.fab {
		display: none;
	}

	@media (max-width: 760px) {
		.top {
			flex-wrap: wrap;
			gap: 10px 12px;
			padding: 10px 16px 10px;
		}
		.brand :global(.nj-wordmark) {
			padding: 7px 12px 5px;
			font-size: 17px;
		}
		.tabs {
			order: 3;
			flex-basis: 100%;
		}
		.tab {
			flex: 1;
			font-size: 19px;
		}
		.persona :global(.nj-persona__opt) {
			min-height: 44px;
			padding-inline: 10px;
			font-size: 17px;
		}
		.new,
		.keys {
			display: none;
		}
		.fab {
			position: fixed;
			z-index: 30;
			right: 16px;
			bottom: calc(18px + env(safe-area-inset-bottom));
			display: grid;
			place-items: center;
			width: 64px;
			height: 64px;
			padding: 0;
			border: 0;
			background: var(--nj-accent);
			color: var(--nj-paper);
			font: 400 44px/1 var(--nj-font-display);
			clip-path: polygon(10% 4%, 100% 0, 92% 96%, 0 100%);
			box-shadow: inset -6px -6px 0 var(--nj-ink);
			transform: rotate(-6deg);
			cursor: pointer;
		}
		.fab span {
			transform: translateY(2px);
		}
		.fab:active {
			transform: rotate(-6deg) scale(0.94);
		}
	}
</style>
