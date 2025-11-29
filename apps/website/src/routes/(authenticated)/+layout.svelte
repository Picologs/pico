<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import { appState, Header, App, Toast } from '@pico/shared';
	import fleetData from '@pico/shared/data/fleet.json';

	let { data, children } = $props();

	// WebSocket configuration - uses runtime env vars for deployment flexibility
	const wsUrl = browser ? env.PUBLIC_WS_URL || 'ws://localhost:8080/ws' : '';

	// Upload URL configuration - website uses its own /api/upload endpoint
	const uploadUrl = browser ? env.PUBLIC_UPLOAD_URL || '/api' : '/api';

	// Download URL - server-side redirect to latest .msi
	const downloadUrl = '/download';

	// Type assertion for App component props
	const appProps: any = {
		wsUrl,
		userId: data.user.discordId,
		token: data.wsToken,
		uploadUrl,
		fleet: fleetData,
		children,
		downloadUrl
	};

	// Initialize appState with user data (direct assignment like desktop app)
	if (browser && data.user) {
		appState.user = data.user;
		if (data.groups) {
			appState.groups = data.groups;
		}
	}

	// Sign out loading state
	let isSigningOut = $state(false);

	// Navigation handler
	function handleNavigate(path: string) {
		goto(path);
	}

	// Set navigation and auth handlers in appState (for Header component)
	appState.navigate = handleNavigate;
	appState.signOut = handleSignOut;

	// Sign out handler with validation and loading state
	async function handleSignOut() {
		if (isSigningOut) return; // Prevent double-clicks

		isSigningOut = true;
		try {
			const response = await fetch('/auth/signout', { method: 'POST' });

			if (!response.ok) {
				throw new Error(`Sign out failed: ${response.status} ${response.statusText}`);
			}

			// Only redirect if sign-out was successful
			goto('/');
		} catch (error) {
			isSigningOut = false;
			// Silently fail - sign out errors are non-critical
			// User can attempt sign out again or close the browser
			throw error; // Re-throw so Header component can handle it
		}
	}
</script>

{#if browser && data.user}
	<App {...appProps} />
{:else}
	<div class="flex h-dvh flex-col bg-primary">
		<Header />

		{@render children()}
	</div>

	<!-- Toast notifications -->
	{#if appState.toasts && appState.toasts.length > 0}
		<Toast notifications={appState.toasts} />
	{/if}
{/if}
