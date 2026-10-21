<script lang="ts">
	/**
	 * New event or edit: title, whose, when, repeats, place and notes. Posts to the event's form
	 * action; the server checks everything again and sends field errors back.
	 */
	import { enhance } from '$app/forms';
	import {
		addDays,
		diffDays,
		isDate,
		isTime,
		minutesOf,
		parseDate,
		timeText,
		WEEKDAY_SHORT,
		weekOrder
	} from '$lib/dates';
	import { OWNER_LABELS, OWNERS, type EventFields, type FieldErrors, type Owner } from '$lib/types';
	import type { SubmitFunction } from '@sveltejs/kit';

	interface Props {
		action: string;
		initial: EventFields;
		weekStart: 0 | 1;
		/** Editing a repeating event: the change applies to every occurrence. */
		series?: boolean;
		errors?: FieldErrors;
		onsaved?: (date: string) => void;
		oncancel?: () => void;
		/** Shown under the buttons, e.g. the delete button. */
		extra?: import('svelte').Snippet;
	}

	let {
		action,
		initial,
		weekStart,
		series = false,
		errors: given = {},
		onsaved,
		oncancel,
		extra
	}: Props = $props();
	const uid = $props.id();

	// svelte-ignore state_referenced_locally
	let f = $state<EventFields>(structuredClone($state.snapshot(initial)) as EventFields);
	// svelte-ignore state_referenced_locally
	let errors = $state<FieldErrors>(given);
	let busy = $state(false);

	/* Moving the start moves the end with it, keeping the length. */
	// svelte-ignore state_referenced_locally
	let lastStartDate = initial.startDate;
	// svelte-ignore state_referenced_locally
	let lastStartTime = initial.startTime;
	function startDateChanged() {
		if (isDate(f.startDate) && isDate(lastStartDate) && isDate(f.endDate)) {
			f.endDate = addDays(f.endDate, diffDays(lastStartDate, f.startDate));
		} else if (isDate(f.startDate)) {
			f.endDate = f.startDate;
		}
		lastStartDate = f.startDate;
	}
	function startTimeChanged() {
		if (
			isTime(f.startTime) &&
			isTime(lastStartTime) &&
			isTime(f.endTime) &&
			f.startDate === f.endDate
		) {
			const end = minutesOf(f.endTime) + minutesOf(f.startTime) - minutesOf(lastStartTime);
			if (end >= 0 && end < 24 * 60) f.endTime = timeText(end);
			else if (end >= 24 * 60) {
				f.endTime = timeText(end - 24 * 60);
				f.endDate = addDays(f.startDate, 1);
			}
		}
		lastStartTime = f.startTime;
	}

	const dayOfMonth = $derived(isDate(f.startDate) ? parseDate(f.startDate).day : 1);
	const hint = $derived.by(() => {
		if (f.repeat === 'monthly' && dayOfMonth > 28)
			return `Months without a ${dayOfMonth}${dayOfMonth === 31 ? 'st' : 'th'} are skipped, like in Google Calendar.`;
		if (f.repeat === 'yearly' && f.startDate.endsWith('-02-29'))
			return '29 February only comes round in leap years.';
		return null;
	});

	function toggleDay(day: number) {
		f.repeatDays = f.repeatDays.includes(day)
			? f.repeatDays.filter((d) => d !== day)
			: [...f.repeatDays, day].sort();
	}

	const submit: SubmitFunction = ({ formData }) => {
		const local: FieldErrors = {};
		if (!f.title.trim()) local.title = 'Give it a title.';
		if (Object.keys(local).length > 0) {
			errors = local;
			return ({ update }) => update({ reset: false });
		}
		busy = true;
		if (f.repeat === 'weekly' && f.repeatDays.length === 0 && isDate(f.startDate)) {
			formData.append('repeatDays', String(new Date(`${f.startDate}T00:00:00Z`).getUTCDay()));
		}
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'failure') {
				errors = (result.data?.errors as FieldErrors | undefined) ?? { form: 'Couldn’t save.' };
				return;
			}
			if (result.type === 'redirect') {
				const date = /\/day\/(\d{4}-\d{2}-\d{2})/.exec(result.location)?.[1] ?? f.startDate;
				errors = {};
				onsaved?.(date);
				return;
			}
			if (result.type === 'error') {
				errors = { form: result.error?.message ?? 'Couldn’t save. Try again.' };
				return;
			}
			await update({ reset: false });
		};
	};

	const ownerOptions = OWNERS as readonly Owner[];
</script>

<form method="POST" {action} use:enhance={submit} class="form" novalidate>
	{#if series}
		<p class="series">Repeating event: changes apply to every occurrence.</p>
	{/if}
	{#if errors.form}<p class="error" role="alert">{errors.form}</p>{/if}

	<label class="field">
		<span>Title</span>
		<input
			name="title"
			bind:value={f.title}
			maxlength="200"
			autocomplete="off"
			required
			aria-invalid={!!errors.title}
			aria-describedby={errors.title ? `${uid}-title` : undefined}
		/>
		{#if errors.title}<small class="error" id="{uid}-title">{errors.title}</small>{/if}
	</label>

	<fieldset class="field">
		<legend>Whose</legend>
		<div class="owners">
			{#each ownerOptions as owner (owner)}
				<label class="owner" data-owner={owner}>
					<input type="radio" name="owner" value={owner} bind:group={f.owner} />
					<span>{OWNER_LABELS[owner]}</span>
				</label>
			{/each}
		</div>
	</fieldset>

	<label class="switch">
		<input type="checkbox" name="allDay" bind:checked={f.allDay} />
		<span>All day</span>
	</label>

	<div class="when">
		<label class="field">
			<span>Starts</span>
			<input
				type="date"
				name="startDate"
				bind:value={f.startDate}
				onchange={startDateChanged}
				required
				aria-invalid={!!errors.startDate}
			/>
			{#if errors.startDate}<small class="error">{errors.startDate}</small>{/if}
		</label>
		{#if !f.allDay}
			<label class="field time">
				<span>At</span>
				<input
					type="time"
					name="startTime"
					bind:value={f.startTime}
					onchange={startTimeChanged}
					required
					aria-invalid={!!errors.startTime}
				/>
				{#if errors.startTime}<small class="error">{errors.startTime}</small>{/if}
			</label>
		{/if}
		<label class="field">
			<span>Ends</span>
			<input
				type="date"
				name="endDate"
				bind:value={f.endDate}
				min={f.startDate}
				aria-invalid={!!errors.endDate}
			/>
			{#if errors.endDate}<small class="error">{errors.endDate}</small>{/if}
		</label>
		{#if !f.allDay}
			<label class="field time">
				<span>At</span>
				<input
					type="time"
					name="endTime"
					bind:value={f.endTime}
					required
					aria-invalid={!!errors.endTime}
				/>
			</label>
		{/if}
	</div>
	{#if errors.endTime}<small class="error">{errors.endTime}</small>{/if}

	<div class="when">
		<label class="field">
			<span>Repeats</span>
			<select
				name="repeat"
				bind:value={f.repeat}
				onchange={() => {
					// Weekly starts with the start date's weekday ticked.
					if (f.repeat === 'weekly' && f.repeatDays.length === 0 && isDate(f.startDate))
						f.repeatDays = [new Date(`${f.startDate}T00:00:00Z`).getUTCDay()];
				}}
			>
				<option value="none">Doesn’t repeat</option>
				<option value="daily">Every day</option>
				<option value="weekly">Every week</option>
				<option value="monthly">Every month (same day)</option>
				<option value="yearly">Every year</option>
			</select>
		</label>
		{#if f.repeat !== 'none'}
			<label class="field">
				<span>Until (optional)</span>
				<input
					type="date"
					name="repeatUntil"
					bind:value={f.repeatUntil}
					min={f.startDate}
					aria-invalid={!!errors.repeatUntil}
				/>
				{#if errors.repeatUntil}<small class="error">{errors.repeatUntil}</small>{/if}
			</label>
		{/if}
	</div>
	{#if f.repeat === 'weekly'}
		<fieldset class="field">
			<legend>On</legend>
			<div class="days">
				{#each weekOrder(weekStart) as day (day)}
					<label class="day" class:weekend={day === 0 || day === 6}>
						<input
							type="checkbox"
							name="repeatDays"
							value={day}
							checked={f.repeatDays.includes(day)}
							onchange={() => toggleDay(day)}
						/>
						<span>{WEEKDAY_SHORT[day]!.slice(0, 2)}</span>
					</label>
				{/each}
			</div>
		</fieldset>
	{/if}
	{#if hint}<p class="hint">{hint}</p>{/if}

	<label class="field">
		<span>Where (optional)</span>
		<input name="location" bind:value={f.location} maxlength="200" autocomplete="off" />
		{#if errors.location}<small class="error">{errors.location}</small>{/if}
	</label>
	<label class="field">
		<span>Notes (optional)</span>
		<textarea name="notes" bind:value={f.notes} rows="3" maxlength="4000"></textarea>
		{#if errors.notes}<small class="error">{errors.notes}</small>{/if}
	</label>

	<div class="actions">
		<button type="submit" class="nj-btn nj-btn--red" disabled={busy}>
			{busy ? 'Saving…' : 'Save'}<i class="nj-btn__arrow" aria-hidden="true"></i>
		</button>
		{#if oncancel}
			<button type="button" class="nj-btn nj-btn--ghost nj-btn--small" onclick={oncancel}
				>Cancel</button
			>
		{/if}
	</div>
</form>
{#if extra}{@render extra()}{/if}

<style>
	.form {
		display: grid;
		gap: 16px;
	}
	.field {
		display: grid;
		gap: 6px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.field > span,
	.field > legend {
		padding: 0;
		color: var(--nj-text-muted);
		font: 700 12px/1.2 var(--nj-font-body);
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.field > legend {
		margin-bottom: 6px;
	}
	input:not([type='checkbox']):not([type='radio']),
	select,
	textarea {
		width: 100%;
		min-height: 46px;
		padding: 8px 12px;
		border: 2px solid var(--nj-surface-raised);
		border-radius: 0;
		background: var(--nj-ink);
		color: var(--nj-text);
		font: 600 17px/1.3 var(--nj-font-body);
		color-scheme: dark;
	}
	textarea {
		resize: vertical;
	}
	input:focus,
	select:focus,
	textarea:focus {
		border-color: var(--nj-hi);
		outline: none;
	}
	[aria-invalid='true'] {
		border-color: var(--nj-red-text) !important;
	}
	.when {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.when .time {
		max-width: none;
	}
	.owners,
	.days {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.owner,
	.day {
		position: relative;
	}
	.owner input,
	.day input,
	.switch input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}
	.owner span,
	.day span {
		display: inline-grid;
		place-items: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0 14px;
		background: var(--nj-ink);
		color: var(--nj-text-muted);
		font: 400 17px/1 var(--nj-font-display);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		clip-path: polygon(6% 0, 100% 5%, 94% 100%, 0 95%);
		box-shadow: inset 0 -4px 0 var(--own, var(--nj-surface-raised));
	}
	.day span {
		padding: 0 8px;
	}
	.owner input:checked + span {
		background: var(--own);
		color: var(--nj-ink);
	}
	.day input:checked + span {
		background: var(--nj-hi);
		color: var(--nj-hi-ink);
	}
	.owner input:focus-visible + span,
	.day input:focus-visible + span,
	.switch input:focus-visible + span {
		outline: 3px solid var(--nj-focus);
		outline-offset: 2px;
	}
	.switch {
		display: inline-flex;
		justify-self: start;
		cursor: pointer;
	}
	.switch span {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		font: 700 16px/1 var(--nj-font-body);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.switch span::before {
		content: '';
		width: 22px;
		height: 22px;
		border: 2px solid var(--nj-text-muted);
		background: var(--nj-ink);
		transform: rotate(-6deg);
	}
	.switch input:checked + span::before {
		border-color: var(--nj-hi);
		background: var(--nj-hi);
		box-shadow: inset 0 0 0 3px var(--nj-ink);
	}
	.series,
	.hint {
		margin: 0;
		padding: 8px 12px;
		background: var(--nj-ink);
		border-left: 4px solid var(--nj-hi);
		font: 600 15px/1.35 var(--nj-font-body);
	}
	.error {
		margin: 0;
		color: var(--nj-red-text);
		font: 700 14px/1.3 var(--nj-font-body);
	}
	p.error {
		padding: 8px 12px;
		background: var(--nj-ink);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 20px;
		padding: 8px 0 4px 4px;
	}
	@media (max-width: 420px) {
		.when {
			gap: 10px;
		}
	}
</style>
