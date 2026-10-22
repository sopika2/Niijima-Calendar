<script lang="ts">
	/** A day as the in-game calendar shows it: 10/21 in a red starburst, the weekday on a plate. */
	import { burstPoints } from '@niijima/design';
	import { parseDate, weekdayOf, WEEKDAY_SHORT, formatDate } from '$lib/dates';

	interface Props {
		date: string;
		/** Size of the digits. */
		size?: string;
		burst?: boolean;
	}

	let { date, size = '56px', burst = true }: Props = $props();
	const parts = $derived(parseDate(date));
	const weekday = $derived(weekdayOf(date));
	const points = $derived(burstPoints(`day-${date}`, 11, 48, 30));
</script>

<div class="nj-hud stamp" style="--hud:{size}" role="img" aria-label={formatDate(date, 'full')}>
	{#if burst}<svg class="nj-hud__burst" viewBox="0 0 100 100" aria-hidden="true"
			><polygon {points} /></svg
		>{/if}
	<div class="nj-hud__date" aria-hidden="true">
		<span class="nj-hud__m">{parts.month}</span><span class="nj-hud__sl">/</span><span
			>{parts.day}</span
		>
	</div>
	<div
		class="nj-hud__dow"
		class:is-sun={weekday === 0}
		class:is-sat={weekday === 6}
		aria-hidden="true"
	>
		{WEEKDAY_SHORT[weekday]}
	</div>
</div>

<style>
	.stamp {
		margin: calc(var(--hud) * 0.3) 0 calc(var(--hud) * 0.15) calc(var(--hud) * 0.35);
	}
</style>
