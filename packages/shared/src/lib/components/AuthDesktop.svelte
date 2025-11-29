<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		/**
		 * Discord client ID for OAuth (optional, defaults to env var or fallback)
		 */
		discordClientId?: string;
		/**
		 * Session ID from URL parameters (optional, extracted from URL if not provided)
		 */
		sessionId?: string;
		/**
		 * Callback URL origin (optional, defaults to window.location.origin)
		 */
		callbackOrigin?: string;
		/**
		 * Optional callback when redirect is triggered
		 */
		onRedirect?: (url: string) => void;
	}

	let { discordClientId, sessionId, callbackOrigin, onRedirect }: Props = $props();

	let error = $state('');

	onMount(() => {
		// Extract session ID from URL if not provided as prop
		const resolvedSessionId =
			sessionId || new URLSearchParams(window.location.search).get('session') || '';

		if (!resolvedSessionId) {
			error = 'No session ID provided';
			return;
		}

		// Resolve Discord client ID: prop > fallback
		const resolvedClientId = discordClientId || '1342740437768867872';

		// Resolve callback origin: prop > window.location.origin
		const resolvedOrigin = callbackOrigin || window.location.origin;

		// Build Discord OAuth authorization URL
		// Use /auth/callback (main OAuth handler) with desktop: prefix in state
		const redirectUri = `${resolvedOrigin}/auth/callback`;
		const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${resolvedClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&state=desktop:${resolvedSessionId}`;

		// Trigger redirect

		// Call optional callback
		if (onRedirect) {
			onRedirect(oauthUrl);
		}

		// Automatically redirect to Discord OAuth
		window.location.href = oauthUrl;
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-primary text-white">
	{#if error}
		<div class="rounded-lg border border-white/10 bg-secondary p-6 text-white">
			<h2 class="mb-2 text-xl font-bold text-danger">Error</h2>
			<p class="text-white/70">{error}</p>
		</div>
	{:else}
		<div class="text-center">
			<p class="text-lg">Redirecting to Discord...</p>
		</div>
	{/if}
</div>
