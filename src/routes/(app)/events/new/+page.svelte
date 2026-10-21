<script lang="ts">
	import { goto } from '$app/navigation';
	import EventForm from '$lib/components/EventForm.svelte';
	import type { EventFields } from '$lib/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const initial = $derived<EventFields>(
		(form?.fields as EventFields | undefined) ?? {
			title: '',
			owner: data.persona,
			allDay: false,
			startDate: data.date,
			startTime: '09:00',
			endDate: data.date,
			endTime: '10:00',
			repeat: 'none',
			repeatDays: [],
			repeatUntil: '',
			location: '',
			notes: ''
		}
	);
</script>

<svelte:head><title>New event · Niijima Calendar</title></svelte:head>

<section class="page">
	<h1 class="kicker">New event</h1>
	<EventForm
		action="/events/new"
		{initial}
		weekStart={data.weekStart}
		errors={form?.errors}
		onsaved={(date) => goto(`/day/${date}`)}
	/>
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
