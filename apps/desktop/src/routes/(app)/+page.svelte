<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { LogFeed, Toast, appState, LoadingOverlay } from '@pico/shared';
	import fleetData from '@pico/shared/data/fleet.json';
	import { initiateOAuthFlow, handleAuthComplete } from '$lib/oauth';
	import {
		startLogWatcher,
		stopLogWatcher,
		selectLogFileManually,
		getSavedLogPath,
		saveLogPath,
		autoDetectGameLog
	} from '$lib/logWatcher';
	import { logApi } from '$lib/logApi.svelte';
	import { FolderOpen, Loader2 } from '@lucide/svelte';
	import type { PageProps } from './$types';

	// Get data from load function (auth check happens before render)
	let { data }: PageProps = $props();

	// Loading state - shows overlay until auth check completes
	let isCheckingAuth = $state(true);

	// Dev mode paste dialog state
	let showPasteUrlDialog = $state(false);
	let pasteUrl = $state('');
	let pasteError = $state('');

	// Hide loading overlay once data is available (auth check complete)
	$effect(() => {
		if (data.authChecked) {
			isCheckingAuth = false;
		}
	});

	// Helper to create player name update callback
	function createPlayerNameCallback() {
		return async (playerName: string) => {
			// Only update profile if authenticated
			if (appState.user && appState.sendRequest) {
				if (appState.user.player === playerName) {
					return;
				}

				try {
					await appState.updateProfile({ player: playerName });
					console.log('[+page] Player name auto-updated:', playerName);
					appState.addToast(`Player name updated to "${playerName}"`, 'success');
				} catch (error) {
					console.error('[+page] Failed to auto-update player name:', error);
					appState.addToast('Failed to update player name', 'error');
				}
			}
		};
	}

	// Initialize on mount
	onMount(async () => {
		console.log('[+page.svelte] Mounted');

		// Connect sign-in handler for Header component
		appState.signIn = handleSignIn;

		// Connect select log file handler for Header component
		appState.selectLogFile = handleSelectLogFile;

		// Auto-detect log file if no saved path exists
		try {
			const savedPath = await getSavedLogPath();

			if (!savedPath) {
				console.log('[+page.svelte] No saved path, attempting auto-detection...');
				const detectedPath = await autoDetectGameLog();

				if (detectedPath) {
					console.log('[+page.svelte] Auto-detected path:', detectedPath);

					// Save the auto-detected path so it persists after auth
					await saveLogPath(detectedPath);

					// Auto-start watching the detected log file
					await startLogWatcher(
						detectedPath,
						undefined,
						false, // Don't clear logs - first run with detected path
						createPlayerNameCallback()
					);

					appState.hasSelectedLog = true;
					appState.logLocation = logApi.logLocation;
					appState.addToast(`Auto-detected and watching ${logApi.logLocation} logs`, 'success');
				} else {
					console.log('[+page.svelte] Auto-detection failed, user will select manually');
					logApi.setLoading(false);
				}
			} else {
				console.log('[+page.svelte] Using saved path:', savedPath);

				// Restore watching state with saved path
				await startLogWatcher(
					savedPath,
					undefined,
					false, // Don't clear logs - restore from storage
					createPlayerNameCallback()
				);

				appState.hasSelectedLog = true;
				appState.logLocation = logApi.logLocation;
				console.log('[+page.svelte] Restored watching state from saved path');
			}
		} catch (error) {
			console.error('[+page.svelte] Error during auto-detection:', error);
			logApi.setLoading(false);
		}
	});

	// Sign in handler
	async function handleSignIn() {
		try {
			console.log('[Auth] Sign in clicked, initiating OAuth flow');
			await initiateOAuthFlow(() => {
				showPasteUrlDialog = true;
			});
		} catch (error) {
			console.error('[Auth] Sign in failed:', error);
			appState.addToast('Failed to sign in. Please try again.', 'error');
		}
	}

	// Handle paste URL submission
	async function handlePasteUrl() {
		try {
			pasteError = '';

			if (!pasteUrl.trim()) {
				pasteError = 'Please paste the callback URL';
				return;
			}

			if (!pasteUrl.startsWith('picologs://auth/callback')) {
				pasteError = 'Invalid URL. Should start with: picologs://auth/callback';
				return;
			}

			console.log('[Auth] Processing pasted URL:', pasteUrl);

			// Parse URL to extract code and state
			const urlObj = new URL(pasteUrl);
			const code = urlObj.searchParams.get('code');
			const state = urlObj.searchParams.get('state');

			if (!code || !state) {
				pasteError = 'Invalid callback URL. Missing code or state parameter.';
				return;
			}

			// Close dialog
			showPasteUrlDialog = false;

			// Process OAuth callback using the same handler as deep links
			console.log('[Auth] Processing pasted OAuth callback', { code, state });
			await handleAuthComplete(code, state);
		} catch (error) {
			console.error('[Auth] Failed to process pasted URL:', error);
			pasteError = 'Failed to process callback URL';
		}
	}

	// Log file selection
	async function handleSelectLogFile() {
		try {
			console.log('[+page.svelte] Selecting log file...');
			const result = await selectLogFileManually();

			if (result) {
				// Reset filters using logApi
				logApi.resetFilters();
				console.log('[+page] Reset filters via logApi');

				// Start watching - clearPreviousLogs: true to clear stored logs when manually selecting new file
				await startLogWatcher(result, undefined, true, createPlayerNameCallback());

				appState.hasSelectedLog = true;
				appState.logLocation = logApi.logLocation;
				appState.addToast(`Watching ${logApi.logLocation || 'custom'} logs`, 'success');
			}
		} catch (error) {
			console.error('[+page.svelte] Error selecting log file:', error);
		}
	}
</script>

{#if browser}
	<!-- Loading overlay - shown while auth check runs in load function -->
	{#if isCheckingAuth}
		<LoadingOverlay />
	{:else}
		<!-- Offline mode: Local log viewer (only shown after auth check completes) -->
		<div class="flex h-full flex-col bg-primary">
			<!-- Local log feed -->
			<LogFeed
				{...{
					logs: appState.filteredLogs,
					fleet: fleetData,
					emptyStateIcon: '',
					autoScroll: true,
					showJumpToPresent: true,
					showScoreboard: false,
					showFilterBar: logApi.isWatching
				} as any}
			>
				{#snippet emptyStateContent()}
					{#if logApi.isLoading}
						<div class="flex flex-col items-center gap-3">
							<Loader2 class="h-8 w-8 animate-spin text-white/70" />
							<p class="text-white/60">Loading logs...</p>
						</div>
					{:else}
						<p class="text-center text-white/60">
							{logApi.isWatching
								? 'Watching for Star Citizen logs...'
								: `Select your Star Citizen Game.log file to get started`}
						</p>
						{#if !logApi.isWatching}
							<p class="text-center text-white/60 text-xs mt-2 max-w-md mx-auto">
								<span class="font-bold"
									>(install drive):\Program Files\Roberts Space Industries\StarCitizen\LIVE</span
								> <br /> If you have file types disabled in Windows, it will just say "Game".
							</p>
							<button
								onclick={handleSelectLogFile}
								class="mx-auto mt-6 flex items-center gap-2 rounded-lg bg-discord px-4 py-2 text-sm text-white transition-colors hover:bg-discord/80"
							>
								<FolderOpen size={16} />
								Select Log File
							</button>
						{/if}
					{/if}
				{/snippet}
			</LogFeed>
		</div>
	{/if}
{/if}

<!-- Toast notifications -->
<Toast
	{...{
		notifications: appState.toasts,
		onRemove: (id: string) => appState.removeToast(id)
	} as any}
/>

<!-- Dev mode paste URL dialog -->
{#if showPasteUrlDialog}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		role="button"
		tabindex="0"
		onclick={(e) => {
			if (e.target === e.currentTarget) showPasteUrlDialog = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape' || (e.key === 'Enter' && e.target === e.currentTarget)) {
				showPasteUrlDialog = false;
			}
		}}
	>
		<div class="w-full max-w-md rounded-lg bg-panel p-6 text-white shadow-xl">
			<h2 class="mb-4 text-xl font-semibold">Paste Callback URL</h2>
			<p class="mb-4 text-sm text-white/70">
				The Discord app should have redirected to a URL starting with
				<code class="text-accent">picologs://auth/callback</code>. Copy and paste it here:
			</p>
			<input
				type="text"
				bind:value={pasteUrl}
				placeholder="picologs://auth/callback?code=..."
				class="w-full rounded-lg border border-white/10 bg-primary px-4 py-2 text-white placeholder-white/30 focus:border-accent focus:outline-none"
			/>
			{#if pasteError}
				<p class="mt-2 text-sm text-red-400">{pasteError}</p>
			{/if}
			<div class="mt-6 flex gap-3">
				<button
					onclick={handlePasteUrl}
					class="flex-1 rounded-lg bg-accent px-4 py-2 text-white transition-colors hover:bg-accent/80"
				>
					Submit
				</button>
				<button
					onclick={() => {
						showPasteUrlDialog = false;
						pasteUrl = '';
						pasteError = '';
					}}
					class="flex-1 rounded-lg border border-white/10 bg-primary px-4 py-2 text-white transition-colors hover:bg-white/5"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}
