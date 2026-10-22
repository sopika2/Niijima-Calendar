<script lang="ts">
	import { Ransom, Stamp } from '@niijima/design/svelte';
	import { enhance } from '$app/forms';
	import { OWNER_LABELS } from '$lib/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let copied = $state<string | null>(null);
	let refreshing = $state(false);

	async function copy(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copied = url;
			setTimeout(() => (copied = null), 2000);
		} catch {
			copied = null;
		}
	}

	const when = (iso: string | null) =>
		iso
			? new Date(iso).toLocaleString('en-GB', {
					weekday: 'short',
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit'
				})
			: 'never';
</script>

<svelte:head><title>Sync · Niijima Calendar</title></svelte:head>

<div class="page">
	<Ransom as="h1" text="SYNC" size="clamp(44px, 9vw, 80px)" seed="sync" />

	<section class="card" aria-labelledby="feed-title">
		<h2 id="feed-title">On your phone</h2>
		{#if data.feeds}
			<p>
				Subscribe to one of these addresses and the calendar shows up in Google Calendar, on the
				iPhone or on Android, updating by itself (phones check every hour or so). Keep the address
				private: anyone with it can read the events.
			</p>
			<ul class="feeds">
				{#each data.feeds as feed (feed.url)}
					<li>
						<span class="label">{feed.label}</span>
						<code>{feed.url}</code>
						<span class="buttons">
							<button type="button" class="icon-btn" onclick={() => copy(feed.url)}
								>{copied === feed.url ? 'Copied' : 'Copy'}</button
							>
							<a class="icon-btn" href={feed.url.replace(/^https?:/, 'webcal:')}>Subscribe</a>
						</span>
					</li>
				{/each}
			</ul>
			<details>
				<summary>How to add it</summary>
				<ul class="howto">
					<li>
						<b>iPhone:</b> tap <em>Subscribe</em> above, or Settings → Calendar → Accounts → Add Account
						→ Other → Add Subscribed Calendar, and paste the address.
					</li>
					<li>
						<b>Google Calendar</b> (and so Android): on a computer open calendar.google.com → Other
						calendars <em>+</em> → From URL, paste the address. On the phone, turn the new calendar on
						under Settings in the Google Calendar app.
					</li>
				</ul>
			</details>
		{:else}
			<p>
				The feed is off. Set <code>FEED_TOKEN</code> in <code>.env</code> (any long random string) and
				restart to get a private address to subscribe to.
			</p>
		{/if}
	</section>

	<section class="card" aria-labelledby="imports-title">
		<h2 id="imports-title">Imported calendars</h2>
		{#if data.imports.length === 0}
			<p>
				None yet. Add a calendar’s iCal address (Google Calendar: Settings → the calendar → Secret
				address in iCal format) to <code>subscriptions</code> in config.yml.
			</p>
		{:else}
			<ul class="imports">
				{#each data.imports as source (source.name)}
					<li data-owner={source.owner}>
						<div>
							<b>{source.name}</b>
							<span class="who">{OWNER_LABELS[source.owner]}</span>
							<small
								>{source.host} · {source.count} events · updated {when(source.lastSuccessAt)}</small
							>
							{#if source.lastError}
								<small class="error"
									>Last try ({when(source.lastAttemptAt)}): {source.lastError}. Showing the last
									copy.</small
								>
							{/if}
						</div>
						{#if source.lastError}<Stamp status="down">Unreachable</Stamp
							>{:else if source.lastSuccessAt}<Stamp status="online">OK</Stamp>{:else}<Stamp
								status="pending">Waiting</Stamp
							>{/if}
					</li>
				{/each}
			</ul>
			<form
				method="POST"
				action="?/refresh"
				use:enhance={() => {
					refreshing = true;
					return async ({ update }) => {
						await update();
						refreshing = false;
					};
				}}
			>
				<button type="submit" class="nj-btn nj-btn--small" disabled={refreshing}
					>{refreshing ? 'Fetching…' : 'Fetch now'}<i class="nj-btn__arrow" aria-hidden="true"
					></i></button
				>
			</form>
			<p class="small">They’re fetched every 30 minutes and are read-only here.</p>
		{/if}
	</section>

	<section class="card" aria-labelledby="api-title">
		<h2 id="api-title">Start page</h2>
		{#if data.api}
			<p>
				Niijima Home reads what’s coming up from <code>{data.api}</code> with the
				<code>HOME_TOKEN</code>.
			</p>
		{:else}
			<p>
				Off. Set <code>HOME_TOKEN</code> in <code>.env</code> to let Niijima Home show what’s coming up.
			</p>
		{/if}
	</section>
</div>

<style>
	.page {
		display: grid;
		gap: 24px;
		width: min(860px, 100%);
		margin: 0 auto;
		padding: 28px 16px 24px;
	}
	.card {
		display: grid;
		gap: 12px;
		padding: 18px 18px 20px;
		background: var(--nj-surface);
		box-shadow: 6px 6px 0 var(--nj-accent);
	}
	h2 {
		margin: 0;
		font: 400 28px/1 var(--nj-font-display);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	p {
		margin: 0;
		font: 500 17px/1.45 var(--nj-font-body);
	}
	code {
		padding: 1px 5px;
		background: var(--nj-ink);
		font:
			600 14px/1.4 ui-monospace,
			monospace;
		overflow-wrap: anywhere;
	}
	.feeds,
	.imports,
	.howto {
		display: grid;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.feeds li {
		display: grid;
		gap: 6px;
		padding: 10px 12px;
		background: var(--nj-ink);
	}
	.label {
		color: var(--nj-hi);
		font: 400 18px/1 var(--nj-font-display);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.feeds code {
		padding: 0;
	}
	.buttons {
		display: flex;
		gap: 8px;
	}
	.buttons .icon-btn {
		background: var(--nj-surface-raised);
		font-size: 16px;
	}
	details {
		font: 500 16px/1.45 var(--nj-font-body);
	}
	summary {
		min-height: 44px;
		display: flex;
		align-items: center;
		font-weight: 700;
		cursor: pointer;
	}
	.howto {
		padding-left: 4px;
	}
	.imports li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 12px;
		border-left: 6px dashed var(--own);
		background: var(--nj-ink);
	}
	.imports div {
		display: grid;
		gap: 4px;
		justify-items: start;
		min-width: 0;
	}
	.imports b {
		font: 700 18px/1.2 var(--nj-font-body);
	}
	small {
		color: var(--nj-text-muted);
		font: 500 14px/1.35 var(--nj-font-body);
		overflow-wrap: anywhere;
	}
	.error {
		color: var(--nj-red-text);
	}
	.small {
		color: var(--nj-text-muted);
		font-size: 15px;
	}
</style>
