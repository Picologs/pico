<script lang="ts">
	import { onMount } from 'svelte';
	import { getSavedLogPath, saveLogPath, selectLogFileManually } from '$lib/logWatcher';
	import { getStoreInstance, getCachedStores, clearStoreCache } from '$lib/store-manager';
	import { Check, X, RefreshCw, FolderOpen, Trash2 } from '@lucide/svelte';

	let savedPath = $state<string | null>(null);
	let storeFilePath = $state<string>('');
	let storeContents = $state<Record<string, any>>({});
	let cachedStores = $state<string[]>([]);
	let isLoading = $state(false);
	let lastAction = $state<string>('');
	let actionSuccess = $state<boolean | null>(null);

	async function loadCurrentPath() {
		isLoading = true;
		lastAction = 'Loading saved path...';
		try {
			savedPath = await getSavedLogPath();
			actionSuccess = true;
			lastAction = savedPath ? `Loaded: ${savedPath}` : 'No saved path found';
		} catch (error) {
			actionSuccess = false;
			lastAction = `Error: ${error}`;
		} finally {
			isLoading = false;
		}
	}

	async function selectAndSavePath() {
		isLoading = true;
		lastAction = 'Opening file picker...';
		try {
			const selected = await selectLogFileManually();
			if (selected) {
				savedPath = selected;
				actionSuccess = true;
				lastAction = `Saved: ${selected}`;
			} else {
				actionSuccess = false;
				lastAction = 'No file selected';
			}
		} catch (error) {
			actionSuccess = false;
			lastAction = `Error: ${error}`;
		} finally {
			isLoading = false;
		}
	}

	async function clearPath() {
		isLoading = true;
		lastAction = 'Clearing saved path...';
		try {
			await saveLogPath(null);
			savedPath = null;
			actionSuccess = true;
			lastAction = 'Path cleared successfully';
		} catch (error) {
			actionSuccess = false;
			lastAction = `Error: ${error}`;
		} finally {
			isLoading = false;
		}
	}

	async function loadStoreDetails() {
		isLoading = true;
		lastAction = 'Loading store details...';
		try {
			const store = await getStoreInstance('settings.json');

			// Note: Tauri Store doesn't expose file path via API
			// Files are saved in app's data directory (e.g., AppData/Local/picologs on Windows)
			storeFilePath = 'settings.json (in app data directory)';

			// Get all keys and values
			const keys = await store.keys();
			const contents: Record<string, any> = {};
			for (const key of keys) {
				contents[key] = await store.get(key);
			}
			storeContents = contents;

			// Get cached stores
			cachedStores = getCachedStores();

			actionSuccess = true;
			lastAction = 'Store details loaded';
		} catch (error) {
			actionSuccess = false;
			lastAction = `Error: ${error}`;
		} finally {
			isLoading = false;
		}
	}

	async function clearCache() {
		clearStoreCache('settings.json');
		cachedStores = getCachedStores();
		lastAction = 'Cache cleared';
		actionSuccess = true;
	}

	onMount(() => {
		loadCurrentPath();
		loadStoreDetails();
	});
</script>

<div class="min-h-screen bg-primary p-8 text-white">
	<div class="mx-auto max-w-4xl space-y-6">
		<h1 class="text-2xl font-bold">Tauri Store Debug Panel</h1>

		<!-- Status Bar -->
		{#if lastAction}
			<div class="flex items-center gap-2 rounded-lg bg-panel p-4 text-sm">
				{#if isLoading}
					<RefreshCw class="h-4 w-4 animate-spin" />
				{:else if actionSuccess === true}
					<Check class="h-4 w-4 text-green-400" />
				{:else if actionSuccess === false}
					<X class="h-4 w-4 text-red-400" />
				{/if}
				<span class="text-white/70">{lastAction}</span>
			</div>
		{/if}

		<!-- Current Saved Path -->
		<div class="rounded-lg bg-panel p-6">
			<h2 class="mb-4 text-lg font-semibold">Current Saved Path</h2>
			<div class="mb-4 rounded bg-primary p-3 font-mono text-sm">
				{savedPath || '<none>'}
			</div>
			<div class="flex gap-2">
				<button
					onclick={loadCurrentPath}
					disabled={isLoading}
					class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm transition-colors hover:bg-accent/80 disabled:opacity-50"
				>
					<RefreshCw class="h-4 w-4" />
					Reload
				</button>
				<button
					onclick={selectAndSavePath}
					disabled={isLoading}
					class="flex items-center gap-2 rounded-lg bg-discord px-4 py-2 text-sm transition-colors hover:bg-discord/80 disabled:opacity-50"
				>
					<FolderOpen class="h-4 w-4" />
					Select & Save New Path
				</button>
				<button
					onclick={clearPath}
					disabled={isLoading || !savedPath}
					class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm transition-colors hover:bg-red-700 disabled:opacity-50"
				>
					<Trash2 class="h-4 w-4" />
					Clear Path
				</button>
			</div>
		</div>

		<!-- Store Details -->
		<div class="rounded-lg bg-panel p-6">
			<h2 class="mb-4 text-lg font-semibold">Store Details</h2>

			<div class="mb-4 space-y-2">
				<div class="text-sm">
					<span class="text-white/50">File Path:</span>
					<code class="ml-2 text-accent">{storeFilePath || 'Loading...'}</code>
				</div>
				<div class="text-sm">
					<span class="text-white/50">Cached Stores:</span>
					<code class="ml-2 text-accent"
						>{cachedStores.length > 0 ? cachedStores.join(', ') : 'None'}</code
					>
				</div>
			</div>

			<h3 class="mb-2 text-sm font-semibold text-white/70">Store Contents</h3>
			<div class="mb-4 max-h-64 overflow-auto rounded bg-primary p-3 font-mono text-sm">
				<pre>{JSON.stringify(storeContents, null, 2)}</pre>
			</div>

			<div class="flex gap-2">
				<button
					onclick={loadStoreDetails}
					disabled={isLoading}
					class="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm transition-colors hover:bg-accent/80 disabled:opacity-50"
				>
					<RefreshCw class="h-4 w-4" />
					Refresh Store Details
				</button>
				<button
					onclick={clearCache}
					disabled={isLoading}
					class="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
				>
					<Trash2 class="h-4 w-4" />
					Clear Cache
				</button>
			</div>
		</div>

		<!-- Instructions -->
		<div class="rounded-lg border border-white/10 bg-panel/50 p-6">
			<h2 class="mb-3 text-lg font-semibold">Testing Instructions</h2>
			<ol class="space-y-2 text-sm text-white/70">
				<li>1. Click "Select & Save New Path" to choose a Game.log file</li>
				<li>2. Verify the path appears in "Current Saved Path"</li>
				<li>3. Refresh the page (Ctrl+R / Cmd+R) and verify path is still there</li>
				<li>
					4. Close and reopen the app, then return to <code class="text-accent">/debug-store</code>
				</li>
				<li>5. Verify the path persisted across app restart</li>
			</ol>
		</div>

		<!-- Console Logs Notice -->
		<div class="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
			<h3 class="mb-2 font-semibold text-yellow-400">📊 Check Console Logs</h3>
			<p class="text-sm text-white/70">
				Open DevTools (F12) and watch for <code class="text-accent">[LogWatcher]</code> and
				<code class="text-accent">[StoreManager]</code> logs to see detailed save/load operations.
			</p>
		</div>
	</div>
</div>
