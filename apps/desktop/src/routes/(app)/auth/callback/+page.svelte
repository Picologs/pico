<script lang="ts">
	/**
	 * OAuth Callback Page
	 *
	 * Processes Discord OAuth deep link callbacks from the website bridge.
	 * Extracts OAuth code and state from URL parameters, exchanges them for
	 * a JWT token via WebSocket, and redirects to the main app.
	 *
	 * Flow:
	 * 1. User authorizes on Discord
	 * 2. Discord redirects to website: https://picologs.com/auth/desktop/callback?code=...
	 * 3. Website redirects to deep link: picologs://auth/callback?code=...&state=...
	 * 4. This page is loaded with URL parameters
	 * 5. Extract code and state from URL
	 * 6. Call handleAuthComplete to exchange for JWT
	 * 7. Redirect to main app (/)
	 */

	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { handleAuthComplete } from '$lib/oauth';

	// Error state
	let error = $state<string | null>(null);
	let processing = $state(true);

	// Extract OAuth parameters from URL using $derived (computed from page store)
	let code = $derived($page.url.searchParams.get('code'));
	let oauthState = $derived($page.url.searchParams.get('state'));

	onMount(async () => {
		console.log('[Auth Callback] Page mounted', { code: !!code, state: !!oauthState });

		if (!code || !oauthState) {
			error = 'Missing OAuth parameters. Please try signing in again.';
			processing = false;
			return;
		}

		try {
			// Exchange OAuth code for JWT and save to store
			await handleAuthComplete(code, oauthState);

			// handleAuthComplete will redirect to '/' automatically
		} catch (err) {
			console.error('[Auth Callback] Auth failed:', err);
			error =
				err instanceof Error ? err.message : 'Authentication failed. Please try signing in again.';
			processing = false;
		}
	});
</script>

<div class="flex h-dvh items-center justify-center bg-primary">
	<div class="flex flex-col items-center gap-4 text-center">
		{#if processing}
			<!-- Processing state -->
			<div class="flex flex-col items-center gap-4">
				<div class="flex flex-col gap-2">
					<h1 class="text-2xl font-semibold text-white">Processing Authentication</h1>
					<p class="text-white/70">Completing sign-in with Discord...</p>
				</div>
			</div>
		{:else if error}
			<!-- Error state -->
			<div class="flex flex-col items-center gap-4">
				<!-- Error icon -->
				<div
					class="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-500"
				>
					<svg
						class="h-6 w-6"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</div>

				<div class="flex flex-col gap-2">
					<h1 class="text-2xl font-semibold text-white">Authentication Failed</h1>
					<p class="max-w-md text-white/70">{error}</p>
				</div>

				<!-- Retry button -->
				<button
					class="mt-4 rounded-lg bg-white/10 px-6 py-3 text-white transition-colors hover:bg-white/20"
					onclick={() => {
						window.location.href = '/';
					}}
				>
					Return to App
				</button>
			</div>
		{/if}
	</div>
</div>
