<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { check } from '@tauri-apps/plugin-updater';
	import { relaunch } from '@tauri-apps/plugin-process';
	import { dev, browser } from '$app/environment';

	type UpdateState = 'checking' | 'downloading' | 'ready' | 'no-update' | 'error';

	let updateState: UpdateState = $state('checking');
	let statusMessage = $state('Checking for updates...');
	let errorMessage = $state('');
	let updateVersion = $state('');
	let totalDownloaded = 0;
	let isDebugBuild = $state(false);

	// Check if running in E2E test mode (detected via URL param or localStorage)
	function isE2ETestMode(): boolean {
		if (!browser) return false;
		// Check URL param
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('e2e') === 'true') return true;
		// Check localStorage flag (can be set by test setup)
		if (localStorage.getItem('e2e_test_mode') === 'true') return true;
		// Check if running in debug build with devtools (tauri-driver sets this)
		// @ts-expect-error - __TAURI_DEBUG__ may not exist
		if (window.__TAURI_DEBUG__ === true) return true;
		return false;
	}

	onMount(async () => {
		console.log('[Splash] Mounted');

		// Check if this is a debug build (for E2E tests)
		// Debug builds should skip update check and auto-close
		try {
			isDebugBuild = await invoke<boolean>('is_debug_build');
			console.log('[Splash] Debug build:', isDebugBuild);
		} catch (error) {
			console.warn('[Splash] Could not check debug build status:', error);
			isDebugBuild = false;
		}

		// In debug builds (E2E tests), auto-close splash screen immediately
		// This bypasses the update check which blocks E2E tests
		if (isDebugBuild) {
			console.log('[Splash] Debug build detected, auto-closing splash...');
			statusMessage = 'Debug mode - skipping update check';
			// Small delay to ensure UI renders before closing
			await new Promise((resolve) => setTimeout(resolve, 100));
			await closeSplash();
			return;
		}

		// In dev mode (vite dev server), show splash with continue button
		if (dev || isE2ETestMode()) {
			console.log('[Splash] Dev/E2E mode - showing continue button');
			updateState = 'checking';
			statusMessage = dev ? 'Checking for updates...' : 'Test mode - ready to continue';
			return;
		}

		// Production: check for updates with timeout
		try {
			// Add timeout to update check (10 seconds)
			const timeoutPromise = new Promise<null>((_, reject) =>
				setTimeout(() => reject(new Error('Update check timed out')), 10000)
			);

			// Check for updates with timeout
			const update = await Promise.race([check(), timeoutPromise]);

			if (update) {
				updateVersion = update.version;
				statusMessage = `Update available: v${update.version}`;
				updateState = 'downloading';
				totalDownloaded = 0;

				// Download and install
				await update.downloadAndInstall((event) => {
					if (event.event === 'Started') {
						statusMessage = 'Downloading update...';
						totalDownloaded = 0;
					} else if (event.event === 'Progress') {
						const chunkLength = event.data.chunkLength || 0;
						totalDownloaded += chunkLength;
						// Note: contentLength is not available, show MB downloaded instead
						const mb = (totalDownloaded / 1024 / 1024).toFixed(2);
						statusMessage = `Downloading: ${mb} MB`;
					} else if (event.event === 'Finished') {
						statusMessage = 'Update installed!';
						updateState = 'ready';
					}
				});

				await relaunch();
			} else {
				// No update available
				updateState = 'no-update';
				statusMessage = 'App is up to date';
				await closeSplash();
			}
		} catch (error) {
			console.error('[Splash] Update check failed:', error);
			updateState = 'error';
			errorMessage = error instanceof Error ? error.message : 'Unknown error';
			statusMessage = 'Failed to check for updates';
			await closeSplash();
		}
	});

	async function closeSplash() {
		try {
			console.log('[Splash] Closing splash screen...');
			await invoke('close_splashscreen');
		} catch (error) {
			console.error('[Splash] Failed to close:', error);
		}
	}
</script>

<div class="flex h-dvh items-center justify-center">
	<div class="flex w-96 flex-col items-center gap-4">
		<!-- Logo -->
		<img src="/pico.webp" alt="Picologs Logo" class="h-20 w-20" />

		<!-- Status Message -->
		<div class="flex items-center gap-3">
			<p class="whitespace-nowrap text-center text-lg text-white/70">{statusMessage}</p>
		</div>

		<!-- Error Message -->
		{#if updateState === 'error' && errorMessage}
			<p class="text-center text-sm text-red-400">{errorMessage}</p>
		{/if}

		<!-- Version Info -->
		{#if updateVersion}
			<p class="text-xs text-white/50">v{updateVersion}</p>
		{/if}

		<!-- Continue Button (Dev/Test Mode) -->
		{#if dev || isDebugBuild || isE2ETestMode()}
			<button
				onclick={closeSplash}
				data-testid="continue-button"
				class="w-full rounded-lg bg-discord px-6 py-3 font-medium text-white transition-colors hover:bg-discord/80"
			>
				Continue to App
			</button>
		{/if}
	</div>
</div>
