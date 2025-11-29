<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * Props for AuthDesktopCallback component
	 * Now used for displaying auth result after WebSocket push
	 */
	interface Props {
		/**
		 * Success flag - true if auth was pushed to desktop successfully
		 */
		success?: boolean;
		/**
		 * Error code if auth failed
		 */
		error?: string | null;
	}

	let { success: successProp, error: errorProp }: Props = $props();

	/**
	 * Status from URL params
	 */
	let success = $state(false);
	let error = $state<string | null>(null);

	onMount(() => {
		// Extract status from URL if not provided as props
		const params = new URLSearchParams(window.location.search);
		success = successProp ?? params.get('success') === 'true';
		error = errorProp ?? params.get('error');
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-primary">
	<div class="text-center max-w-md px-4">
		{#if success}
			<div class="mb-6">
				<svg
					class="w-16 h-16 mx-auto text-green-500"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>
			<h1 class="mb-4 text-2xl font-bold text-white">Authentication Complete!</h1>
			<p class="text-white/70 mb-6">
				You've been signed in successfully. You can close this tab and return to Picologs.
			</p>
			<p class="text-white/50 text-sm">
				The desktop app should now be logged in automatically.
			</p>
		{:else if error}
			<div class="mb-6">
				<svg
					class="w-16 h-16 mx-auto text-red-500"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>
			<h1 class="mb-4 text-2xl font-bold text-white">Authentication Failed</h1>
			<p class="text-white/70 mb-6">
				{#if error === 'push_failed'}
					Unable to connect to the desktop app. Please make sure Picologs is running and try again.
				{:else if error === 'server_error'}
					A server error occurred. Please try again later.
				{:else}
					An error occurred during authentication. Please try again.
				{/if}
			</p>
			<p class="text-white/50 text-sm">
				Close this tab and try signing in again from the desktop app.
			</p>
		{:else}
			<h1 class="mb-4 text-2xl font-bold text-white">Processing...</h1>
			<p class="text-white/70">Please wait while we complete authentication.</p>
		{/if}
	</div>
</div>
