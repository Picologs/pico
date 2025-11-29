<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
	import { appState } from '@pico/shared';
	import { clearAuthData } from '$lib/oauth';
	import { logState } from '$lib/logState.svelte';
	import WindowControls from '$lib/components/WindowControls.svelte';
	import HeaderContent from '$lib/components/HeaderContent.svelte';

	let { children } = $props();

	// Handle double-click to maximize/restore window
	async function handleTitlebarDoubleClick() {
		try {
			const window = getCurrentWebviewWindow();
			await window.toggleMaximize();
		} catch (error) {
			console.error('[Layout] Failed to toggle maximize:', error);
		}
	}

	// Handle clear logs (Tauri storage cleanup)
	// Works for both offline and online modes
	async function handleClearLogs() {
		console.log('[Layout] Clearing logs via logApi');
		try {
			const { logApi } = await import('$lib/logApi.svelte');
			// Use clearLogsOnly() to preserve lastLineCount
			// This prevents the watcher from re-parsing the entire file
			logApi.clearLogsOnly();
		} catch (error) {
			console.error('[Layout] Failed to clear logs:', error);
		}
	}

	// Bootstrap Tauri features on mount
	onMount(async () => {
		if (!browser) return;

		// Show window after content is ready (prevents flash on startup)
		// IMPORTANT: Only show non-main windows. Main window is controlled by close_splashscreen command.
		try {
			const window = getCurrentWebviewWindow();
			const label = window.label;

			// Only show the window if it's NOT the main window
			// Main window visibility is controlled by the close_splashscreen Rust command
			// after the splash screen completes
			if (label !== 'main') {
				await window.show();
				console.log(`[Layout] Window shown: ${label}`);
			} else {
				console.log(
					'[Layout] Skipping window.show() for main window (controlled by splash screen)'
				);
			}
		} catch (error) {
			console.error('[Layout] Failed to show window:', error);
		}

		// Register sign-out handler (persists across all routes)
		appState.signOut = async () => {
			try {
				console.log('[Layout] Signing out...');

				// Set flag to prevent auth check during sign-out
				appState.isSigningOut = true;

				// Force save any pending log changes before signing out
				await logState.forceSave();

				// Clear stored auth from Tauri store
				await clearAuthData();

				// Reset all appState (clears user, friends, groups, logs, Maps, Sets, etc.)
				appState.reset();

				// Reset offline log state to show welcome message
				appState.hasSelectedLog = false;
				appState.hasLogs = false;
				appState.logLocation = null;

				// Clear saved log path and stored logs
				try {
					const { saveLogPath, clearStoredLogs, stopLogWatcher } = await import('$lib/logWatcher');
					await stopLogWatcher();
					await saveLogPath(null);
					await clearStoredLogs(true);
					console.log('[Layout] Cleared log watcher state and stored data');
				} catch (error) {
					console.error('[Layout] Failed to clear log state:', error);
				}

				// Redirect to root page (this unmounts authenticated layout, disconnecting WebSocket)
				await goto('/');

				// Reset flag after navigation completes
				appState.isSigningOut = false;

				console.log('[Layout] Sign out complete');
				appState.addToast('Signed out successfully', 'success');
			} catch (error) {
				console.error('[Layout] Sign out failed:', error);
				appState.addToast('Failed to sign out. Please try again.', 'error');
				// Reset flag even on error
				appState.isSigningOut = false;
			}
		};

		// Install Tauri WebSocket polyfill (required before any WebSocket connections)
		// This polyfill makes Tauri's WebSocket API compatible with standard WebSocket API
		// enabling App.svelte from shared-svelte to work transparently
		try {
			const { installTauriWebSocketPolyfill } = await import('$lib/tauri-websocket-adapter');
			installTauriWebSocketPolyfill();
			console.log('[Tauri] WebSocket polyfill installed');
		} catch (error) {
			console.warn('[Tauri] WebSocket polyfill not available:', error);
		}

		// Initialize deep link handler for OAuth callback
		try {
			const { initializeDeepLinkHandler, exposeOAuthForTesting } = await import('$lib/oauth');

			// Always expose OAuth functions for testing first (before deep link init)
			exposeOAuthForTesting();

			// Then initialize deep link handler
			await initializeDeepLinkHandler();
			console.log('[Tauri] Deep link handler initialized');
		} catch (error) {
			console.warn('[Tauri] Deep link handler not available:', error);

			// Even if deep link init fails, still expose OAuth for testing
			try {
				const { exposeOAuthForTesting } = await import('$lib/oauth');
				exposeOAuthForTesting();
			} catch (e) {
				console.error('[Testing] Failed to expose OAuth API:', e);
			}
		}

		// Expose appState to window for E2E testing
		if (typeof window !== 'undefined') {
			(window as any).__APP_STATE__ = appState;
			console.log('[Testing] appState exposed to window.__APP_STATE__');
		}

		// Suppress ResizeObserver loop warning (known issue with virtual scrolling)
		// This error occurs when ResizeObserver callbacks trigger DOM changes that cause
		// more resize observations in the same frame. It's a benign warning that doesn't
		// affect functionality, caused by the virtual scrolling implementation in LogList.
		window.addEventListener('error', (e) => {
			if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
				e.stopImmediatePropagation();
				return false;
			}
		});
	});
</script>

<!-- Custom Titlebar with Drag Region -->
<div
	role="toolbar"
	tabindex="-1"
	data-tauri-drag-region
	ondblclick={handleTitlebarDoubleClick}
	class="fixed left-0 right-0 top-0 z-50 flex h-9 w-full items-center bg-secondary px-1"
>
	<!-- Logo -->
	<div class="flex flex-shrink-0 items-center">
		<img src="/pico.webp" alt="Picologs" class="h-7 w-7 pointer-events-none" />
	</div>

	<!-- Empty spacer (flex-1 creates the draggable empty space) -->
	<div class="flex-1"></div>

	<!-- Header Controls -->
	<div class="flex items-center justify-end" style="pointer-events: auto;">
		<HeaderContent onClearLogs={handleClearLogs} />
	</div>

	<!-- Window Controls -->
	<div class="flex-shrink-0" style="pointer-events: auto;">
		<WindowControls />
	</div>
</div>

<!-- Main Content with Rounded Corners -->
<div data-testid="app-root" class="mt-9 h-[calc(100dvh-2.25rem)] rounded-2xl bg-primary">
	{@render children?.()}
</div>
