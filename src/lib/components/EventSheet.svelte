<script lang="ts">
	/**
	 * The one sheet for events: slides up from the bottom on a phone, a dialog on a computer.
	 * Shows an event, or the form to add or change one. Imported events are read-only.
	 */
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Ransom } from '@niijima/design/svelte';
	import { minutesOf, timeText } from '$lib/dates';
	import { closeEditor, editEvent, editor, notify } from '$lib/editor.svelte';
	import { OWNER_LABELS, type EventFields, type Owner } from '$lib/types';
	import { mapLink, repeatText, whenText } from '$lib/ui';
	import { zonedParts } from '$lib/zone';
	import EventForm from './EventForm.svelte';

	interface Props {
		persona: 'makoto' | 'sae';
		today: string;
		timeZone: string;
		weekStart: 0 | 1;
		/** After saving: where the saved event starts. */
		onsaved?: (date: string) => void;
	}

	let { persona, today, timeZone, weekStart, onsaved }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();
	let confirming = $state(false);

	$effect(() => {
		if (!dialog) return;
		if (editor.open && !dialog.open) {
			confirming = false;
			dialog.showModal();
		} else if (!editor.open && dialog.open) dialog.close();
	});

	function blank(date: string, time: string | null): EventFields {
		let start = 9 * 60;
		if (time) start = minutesOf(time);
		else if (date === today) {
			const now = minutesOf(zonedParts(Date.now(), timeZone).time);
			start = Math.min(23 * 60, (Math.floor(now / 60) + 1) * 60);
		}
		return {
			title: '',
			owner: persona as Owner,
			allDay: false,
			startDate: date,
			startTime: timeText(start),
			endDate: date,
			endTime: timeText(Math.min(start + 60, 23 * 60 + 59)),
			repeat: 'none',
			repeatDays: [],
			repeatUntil: '',
			location: '',
			notes: ''
		};
	}

	const initial = $derived.by((): EventFields => {
		const event = editor.event;
		if (editor.mode !== 'edit' || !event) return blank(editor.date ?? today, editor.time);
		return {
			title: event.title,
			owner: event.owner,
			allDay: event.allDay,
			startDate: event.startDate,
			startTime: event.startTime ?? '09:00',
			endDate: event.endDate,
			endTime: event.endTime ?? '10:00',
			repeat: event.repeat,
			repeatDays: [...event.repeatDays],
			repeatUntil: event.repeatUntil ?? '',
			location: event.location ?? '',
			notes: event.notes ?? ''
		};
	});

	const occurrence = $derived(editor.occurrence);
	const title = $derived(
		editor.mode === 'new'
			? 'NEW EVENT'
			: editor.mode === 'edit'
				? 'EDIT'
				: (occurrence?.title ?? '')
	);

	async function saved(date: string, message: string) {
		closeEditor();
		await invalidateAll();
		notify(message);
		onsaved?.(date);
	}
</script>

<dialog
	bind:this={dialog}
	class="sheet"
	aria-labelledby="sheet-title"
	onclose={closeEditor}
	onclick={(event) => {
		if (event.target === dialog) closeEditor();
	}}
>
	{#if editor.open}
		{#key editor.key}
			<div class="inner">
				<header class="head">
					{#if editor.mode === 'view'}
						<h2 id="sheet-title" class="title">{title}</h2>
					{:else}
						<Ransom as="h2" text={title} size="34px" seed="sheet-{editor.mode}" />
						<span id="sheet-title" class="nj-sr">{title}</span>
					{/if}
					<button type="button" class="icon-btn close" onclick={closeEditor} aria-label="Close"
						>✕</button
					>
				</header>

				{#if editor.mode === 'view' && occurrence}
					<div class="detail" data-owner={occurrence.owner}>
						<p class="when">{whenText(occurrence)}</p>
						<div class="tags">
							<span class="who">{OWNER_LABELS[occurrence.owner]}</span>
							{#if occurrence.source}<span class="via">From {occurrence.source} · read-only</span
								>{/if}
						</div>
						{#if editor.event && repeatText(editor.event)}
							<p class="line"><b>Repeats</b>{repeatText(editor.event)}</p>
						{/if}
						{#if occurrence.location}
							<p class="line">
								<b>Where</b><a
									href={mapLink(occurrence.location)}
									target="_blank"
									rel="noopener noreferrer">{occurrence.location}</a
								>
							</p>
						{/if}
						{#if occurrence.notes}<p class="notes">{occurrence.notes}</p>{/if}

						{#if editor.event}
							{#if confirming}
								<form
									method="POST"
									action="/events/{editor.event.id}?/delete"
									class="confirm"
									use:enhance={() =>
										async ({ result }) => {
											if (result.type === 'redirect') await saved(occurrence.startDate, 'Deleted.');
											else notify('Couldn’t delete. Try again.');
										}}
								>
									<p>
										{editor.event.repeat === 'none'
											? 'Delete this event?'
											: 'Delete the whole series? Every occurrence goes.'}
									</p>
									<div class="row">
										<button type="submit" class="nj-btn nj-btn--red nj-btn--small">Delete</button>
										<button
											type="button"
											class="nj-btn nj-btn--ghost nj-btn--small"
											onclick={() => (confirming = false)}>Keep it</button
										>
									</div>
								</form>
							{:else}
								<div class="row">
									<button type="button" class="nj-btn nj-btn--small" onclick={editEvent}
										>Edit<i class="nj-btn__arrow" aria-hidden="true"></i></button
									>
									<button
										type="button"
										class="nj-btn nj-btn--ghost nj-btn--small"
										onclick={() => (confirming = true)}>Delete</button
									>
								</div>
							{/if}
						{/if}
					</div>
				{:else if editor.mode !== 'view'}
					<EventForm
						action={editor.mode === 'edit' && editor.event
							? `/events/${editor.event.id}?/save`
							: '/events/new'}
						{initial}
						{weekStart}
						series={editor.mode === 'edit' && editor.event?.repeat !== 'none'}
						onsaved={(date) => saved(date, editor.mode === 'new' ? 'Added.' : 'Saved.')}
						oncancel={closeEditor}
					/>
				{/if}
			</div>
		{/key}
	{/if}
</dialog>

<style>
	.sheet {
		width: min(600px, calc(100vw - 32px));
		max-width: none;
		max-height: min(90dvh, 900px);
		margin: auto;
		padding: 0;
		border: 0;
		background: var(--nj-surface);
		color: var(--nj-text);
		box-shadow:
			10px 10px 0 var(--nj-accent),
			0 0 0 2px var(--nj-ink);
		overflow: auto;
		overscroll-behavior: contain;
	}
	.sheet::backdrop {
		background: var(--nj-veil);
		backdrop-filter: blur(2px);
	}
	.sheet[open] {
		animation: sheet-in var(--nj-normal) var(--nj-snap) both;
	}
	@keyframes sheet-in {
		from {
			opacity: 0;
			transform: translateY(24px) rotate(1deg);
		}
	}
	.inner {
		display: grid;
		gap: 18px;
		padding: 22px 22px 26px;
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.title {
		margin: 0;
		font: 400 clamp(28px, 6vw, 38px) / 1.02 var(--nj-font-display);
		letter-spacing: 0.02em;
		text-transform: uppercase;
		overflow-wrap: anywhere;
	}
	.close {
		flex: none;
		font-family: var(--nj-font-body);
	}
	.detail {
		display: grid;
		gap: 14px;
		padding-left: 14px;
		border-left: 6px solid var(--own);
	}
	.when {
		margin: 0;
		font: 700 20px/1.3 var(--nj-font-body);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.line {
		display: grid;
		gap: 2px;
		margin: 0;
		font: 600 16px/1.4 var(--nj-font-body);
	}
	.line b {
		color: var(--nj-text-muted);
		font-size: 12px;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.notes {
		margin: 0;
		padding: 10px 14px;
		background: var(--nj-ink);
		font: 500 16px/1.45 var(--nj-font-body);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 22px;
		align-items: center;
		padding: 6px 0 2px 4px;
	}
	.confirm {
		display: grid;
		gap: 8px;
		padding: 12px;
		background: var(--nj-ink);
	}
	.confirm p {
		margin: 0;
		font-weight: 700;
	}
	@media (max-width: 640px) {
		.sheet {
			width: 100vw;
			max-height: 92dvh;
			margin: auto 0 0;
			box-shadow: 0 -6px 0 var(--nj-accent);
		}
		.sheet[open] {
			animation-name: sheet-up;
		}
		@keyframes sheet-up {
			from {
				transform: translateY(40%);
			}
		}
		.inner {
			padding: 18px 16px calc(24px + env(safe-area-inset-bottom));
		}
	}
</style>
