<script lang="ts">
	import { onMount } from 'svelte';
	import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
	import {
		App,
		appState,
		LoadingOverlay,
		initPatternCache,
		destroyPatternCache,
		setBetaTesterEnabled
	} from '@pico/shared';
	import fleetData from '@pico/shared/data/fleet.json';
	import { goto, beforeNavigate } from '$app/navigation';

	let { data, children } = $props();

	// Loading state - hide UI until WebSocket connects and data loads
	let isReady = $state(false);
	// splashClosed is always true - being in authenticated layout means splash closed
	let splashClosed = $state(true);
	let initialGroupsLength = $state<number | null>(null);
	let initialFriendsLength = $state<number | null>(null);
	let connectionTimestamp = $state<number | null>(null);
	let timeCheckPassed = $state(false);
	let patternCacheInitialized = $state(false);

	// WebSocket URL from environment
	const wsUrl =
		import.meta.env.VITE_WS_URL_DEV ||
		import.meta.env.VITE_WS_URL_PROD ||
		'wss://ws.picologs.com/ws';

	// Upload server URL from environment
	const uploadUrl =
		import.meta.env.VITE_UPLOAD_URL_DEV ||
		import.meta.env.VITE_UPLOAD_URL_PROD ||
		'https://ws.picologs.com';

	// Get auth data from load function
	// Use $derived to create stable references that don't recreate on every render
	const userId = $derived(data.user.discordId);
	const token = $derived(data.token);

	// Initialize appState with user data (for shared components) - direct assignment
	if (data.user && data.token) {
		console.log('[AuthLayout] Initializing appState with user data');
		appState.user = data.user;
		appState.token = data.token;
	}

	// Capture initial lengths and connection timestamp
	$effect(() => {
		if (appState.connectionStatus === 'connecting' && initialGroupsLength === null) {
			initialGroupsLength = appState.groups?.length ?? 0;
			initialFriendsLength = appState.friends?.length ?? 0;
			console.log('[AuthLayout] Captured initial lengths:', {
				initialGroupsLength,
				initialFriendsLength
			});
		}

		if (appState.connectionStatus === 'connected' && connectionTimestamp === null) {
			connectionTimestamp = Date.now();
			console.log('[AuthLayout] Connection timestamp recorded');
		}
	});

	// Time-based trigger for new users with 0 friends/groups
	// $effect doesn't re-run based on time passing, so we need a reactive trigger
	$effect(() => {
		if (appState.connectionStatus === 'connected' && !timeCheckPassed) {
			const timer = setTimeout(() => {
				timeCheckPassed = true;
				console.log('[AuthLayout] Time check passed (150ms since connection)');
			}, 150);

			return () => clearTimeout(timer);
		}
	});

	// Watch for connection and initial data load
	$effect(() => {
		// Early exit if already ready (prevent re-running)
		if (isReady) return;

		const isConnected = appState.connectionStatus === 'connected';
		const currentGroupsLength = appState.groups?.length ?? 0;
		const currentFriendsLength = appState.friends?.length ?? 0;

		// Data has been fetched if lengths changed from initial
		const groupsUpdated =
			initialGroupsLength !== null && currentGroupsLength !== initialGroupsLength;
		const friendsUpdated =
			initialFriendsLength !== null && currentFriendsLength !== initialFriendsLength;
		const dataFetched = groupsUpdated || friendsUpdated;

		// Check if enough time has passed since connection to allow "empty" state
		// Uses reactive timeCheckPassed instead of Date.now() (which isn't reactive)
		const hasWaitedEnough = timeCheckPassed;

		// Reduced logging - only log when conditions change significantly
		if (dataFetched && !isReady) {
			console.log('[AuthLayout] Data fetched:', { currentGroupsLength, currentFriendsLength });
		}

		// Mark as ready once connected AND (data fetched OR user genuinely has 0 of both after waiting)
		const bothEmpty = currentGroupsLength === 0 && currentFriendsLength === 0;
		if (isConnected && (dataFetched || (bothEmpty && hasWaitedEnough))) {
			// Mark AuthLayout as ready immediately - don't wait for group members
			// Group members will load in background after dashboard renders
			console.log('[AuthLayout] Ready - Connected and data loaded');
			isReady = true;

			// Set layoutReady to allow dashboard to start processing
			console.log('[AuthLayout] Setting layoutReady');
			appState.layoutReady = true;
		}
	});

	// Initialize pattern cache for log schema discovery when WebSocket connects
	$effect(() => {
		if (
			appState.connectionStatus === 'connected' &&
			appState.sendRequest &&
			!patternCacheInitialized
		) {
			console.log('[AuthLayout] Initializing pattern cache for log schema sync');
			patternCacheInitialized = true;

			// Enable/disable pattern collection based on beta tester status
			const isBetaTester = data.user?.betaTester ?? false;
			setBetaTesterEnabled(isBetaTester);
			console.log(`[AuthLayout] Beta tester mode: ${isBetaTester ? 'enabled' : 'disabled'}`);

			// Capture sendRequest reference for use in callback
			const sendRequest = appState.sendRequest;
			initPatternCache((patterns) => {
				// Fire-and-forget pattern reporting
				sendRequest('report_log_patterns', { patterns })
					.then(() => console.log(`[AuthLayout] Reported ${patterns.length} patterns to server`))
					.catch((err) => console.error('[AuthLayout] Failed to report patterns:', err));
			});
		}
	});

	// Navigation handler for Header component
	function handleNavigate(path: string) {
		// Intercept home navigation to prevent root page mount
		// This prevents the auth check/redirect cycle that causes App component to remount
		if (path === '/') {
			goto('/dashboard', { replaceState: true });
		} else {
			goto(path);
		}
	}

	// Register navigation handler in appState
	appState.navigate = handleNavigate;

	// Handle clear logs (Tauri storage cleanup for authenticated mode)
	// Wrap in $derived for stability to prevent recreation on every render
	const handleClearLogs = $derived(async () => {
		console.log('[AuthLayout] Clearing logs from UI and storage');
		try {
			const { logApi } = await import('$lib/logApi.svelte');
			// Use clearLogsOnly() to preserve lastLineCount
			// This prevents the watcher from re-parsing the entire file
			logApi.clearLogsOnly();
		} catch (error) {
			console.error('[AuthLayout] Failed to clear logs:', error);
		}
	});

	// Create stable props object to prevent component remounting
	// Inline object spreads create new references on every render
	const appProps: any = $derived({
		wsUrl,
		userId,
		token,
		uploadUrl,
		uploadFetchFn: tauriFetch,
		fleet: fleetData,
		onClearLogs: handleClearLogs,
		hideHeader: true
	});

	// Note: initializeEffects() is called by App.svelte, not here
	// Calling it twice causes issues with $effect dependencies
	onMount(() => {
		console.log('[AuthLayout] Mounted');

		// Prewarm logs.json store while WebSocket connects
		// This overlaps store I/O with network latency
		import('$lib/store-manager').then(({ getStoreInstance }) => {
			getStoreInstance('logs.json');
			console.log('[AuthLayout] Prewarmed logs.json store');
		});

		// Cleanup on unmount
		return () => {
			console.log('[AuthLayout] Unmounting - destroying pattern cache');
			destroyPatternCache();
		};
	});

	// Intercept navigation to root page to prevent remounting
	// SubNav uses <a href="/"> which bypasses appState.navigate
	// This hook catches it before the root page mounts
	beforeNavigate((navigation) => {
		// Allow navigation during sign-out
		if (appState.isSigningOut) return;

		if (navigation.to?.route.id === '/' || (navigation.to?.route.id as string) === '/waiting') {
			// Cancel navigation to root or waiting page and go to dashboard instead
			navigation.cancel();
			goto('/dashboard', { replaceState: true });
		}
	});
</script>

<!-- Wrap all authenticated routes with App component for persistent WebSocket -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative h-full [&>div:not([popover])]:!h-full [&>div:not([popover])]:!max-h-full">
	<!-- App component renders immediately so WebSocket can connect -->
	<App {...appProps}>
		{@render children()}
	</App>

	<!-- Loading overlay - covers UI until data is loaded -->
	{#if !isReady}
		<LoadingOverlay />
	{/if}
</div>
