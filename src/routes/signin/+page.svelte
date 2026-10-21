<script lang="ts">
	import { Bands, Button, Ransom, Speech, Wordmark } from '@niijima/design/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const MESSAGES = {
		signed_out: 'Signed out. See you soon.',
		expired: 'That sign-in took too long. Try again.',
		failed: 'Discord didn’t let the sign-in through. Try again in a moment.',
		refused: 'This Discord account isn’t on the list for the calendar.'
	} as const;
	const message = $derived(data.message ? MESSAGES[data.message as keyof typeof MESSAGES] : null);

	const href = $derived(
		data.next === '/' ? '/auth/login' : `/auth/login?next=${encodeURIComponent(data.next)}`
	);

	let copied = $state(false);
	async function copyId() {
		if (!data.refusedId) return;
		try {
			await navigator.clipboard.writeText(data.refusedId);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in · Niijima Calendar</title>
</svelte:head>

<main class="signin">
	<Bands ghost="Calendar" />
	<div class="panel">
		<Wordmark name="Niijima Calendar" kanji="新島暦" />
		<Ransom as="h1" text="SIGN IN" size="clamp(52px, 13vw, 110px)" seed="signin" animate />
		<Speech tag={{ word: 'Members only' }} tail={false}>
			<p class="text">The sisters’ calendar. Sign in with the Discord account on the list.</p>
			{#if message}
				<div class="message" class:refused={data.message === 'refused'} role="status">
					<p>{message}</p>
					{#if data.refusedId}
						<p class="help">
							To let it in, add this id to <code>access.discord_user_ids</code> in config.yml:
						</p>
						<button type="button" class="id" onclick={copyId}>
							<code>{data.refusedId}</code>
							<span>{copied ? 'Copied' : 'Copy'}</span>
						</button>
					{/if}
				</div>
			{/if}
			<Button {href} variant="red">Sign in with Discord</Button>
		</Speech>
	</div>
</main>

<style>
	.signin {
		position: relative;
		isolation: isolate;
		display: grid;
		align-items: center;
		min-height: 100dvh;
		overflow: hidden;
		padding: 32px clamp(16px, 8vw, 128px);
	}
	.panel {
		display: grid;
		justify-items: start;
		gap: 28px;
		width: min(560px, 100%);
	}
	.panel :global(.nj-speech) {
		width: 100%;
	}
	.text {
		margin: 6px 0 18px;
		font: 700 18px/1.35 var(--nj-font-body);
	}
	.message {
		display: grid;
		gap: 8px;
		margin-bottom: 22px;
		padding: 10px 14px;
		background: var(--nj-sae-gold);
		color: var(--nj-ink);
		font-weight: 700;
	}
	.message.refused {
		background: var(--nj-ink);
		color: var(--nj-paper);
	}
	.message p {
		margin: 0;
	}
	.help {
		font-size: 14px;
		font-weight: 500;
	}
	.id {
		display: inline-flex;
		justify-self: start;
		gap: 12px;
		min-height: 44px;
		align-items: center;
		padding: 4px 12px;
		border: 2px dashed currentColor;
		background: none;
		color: inherit;
		cursor: pointer;
	}
</style>
