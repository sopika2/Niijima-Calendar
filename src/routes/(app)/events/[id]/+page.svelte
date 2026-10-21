<script lang="ts">
	import { goto } from '$app/navigation';
	import EventForm from '$lib/components/EventForm.svelte';
	import type { EventFields } from '$lib/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const initial = $derived<EventFields>(
		(form?.fields as EventFields | undefined) ?? {
			title: data.event.title,
			owner: data.event.owner,
			allDay: data.event.allDay,
			startDate: data.event.startDate,
			startTime: data.event.startTime ?? '09:00',
			endDate: data.event.endDate,
			endTime: data.event.endTime ?? '10:00',
			repeat: data.event.repeat,
			repeatDays: [...data.event.repeatDays],
			repeatUntil: data.event.repeatUntil ?? '',
			location: data.event.location ?? '',
			notes: data.event.notes ?? ''
		}
	);
</script>

<svelte:head><title>{data.event.title} · Niijima Calendar</title></svelte:head>

<section class="page">
	<h1 class="kicker">Edit event</h1>
	<EventForm
		action="/events/{data.event.id}?/save"
		{initial}
		weekStart={data.weekStart}
		series={data.event.repeat !== 'none'}
		errors={form?.errors}
		onsaved={(date) => goto(`/day/${date}`)}
	>
		{#snippet extra()}
			<form method="POST" action="/events/{data.event.id}?/delete">
				<button type="submit" class="nj-btn nj-btn--ghost nj-btn--small">Delete</button>
			</form>
		{/snippet}
	</EventForm>
</section>

<style>
	.page {
		display: grid;
		gap: 16px;
		width: min(600px, 100%);
		margin: 0 auto;
		padding: 24px 16px 48px;
	}
</style>
