<script lang="ts">
	import LogFeed from './LogFeed.svelte';
	import SidePanel from './SidePanel.svelte';
	import FooterBar from './FooterBar.svelte';
	import Resizer from './Resizer.svelte';
	import { appState } from '../app.svelte.js';
	import { useEmptyStateMessage } from '../utils/useEmptyStateMessage.svelte.js';
	import type { FleetDatabase } from '../utils/ship-utils.js';
	import { Loader2 } from '@lucide/svelte';

	// Props
	interface Props {
		fleet?: FleetDatabase;
		appVersion?: string;
	}

	let { fleet = undefined, appVersion = undefined }: Props = $props();

	// Context-aware empty state message
	const emptyStateMessage = $derived(useEmptyStateMessage()());

	// Check if we're still connecting (no data loaded yet)
	const isConnecting = $derived(
		appState.connectionStatus === 'connecting' &&
		appState.friends.length === 0 &&
		appState.groups.length === 0
	);

	// Bind to the SidePanel instance
	let sidePanelRef = $state<SidePanel | undefined>(undefined);

	// State for groups and friends visibility
	let showGroups = $state(true);
	let showFriends = $state(true);

	// Update state based on SidePanel collapse state
	$effect(() => {
		if (sidePanelRef) {
			showGroups = !sidePanelRef.isGroupsCollapsed();
			showFriends = !sidePanelRef.isFriendsCollapsed();
		}
	});

	// Toggle handlers
	function handleToggleGroups() {
		if (sidePanelRef) {
			sidePanelRef.toggleGroups();
		}
	}

	function handleToggleFriends() {
		if (sidePanelRef) {
			sidePanelRef.toggleFriends();
		}
	}
</script>


<div class="flex h-full flex-col">
	{#if isConnecting}
		<!-- Loading overlay while connecting -->
		<div class="flex flex-1 items-center justify-center bg-primary">
			<div class="flex flex-col items-center gap-3 text-secondary">
				<Loader2 class="h-8 w-8 animate-spin" />
				<p class="text-sm">Connecting...</p>
			</div>
		</div>
	{:else}
		<div class="flex-1 overflow-hidden">
			<Resizer
				direction="horizontal"
				storageKey="horizontal"
				initialFirstSize={230}
				initialSecondSize={500}
			>
				{#snippet firstPanel()}
					<div class="flex h-full flex-col">
						<SidePanel bind:this={sidePanelRef} />
					</div>
				{/snippet}

				{#snippet secondPanel()}
					<LogFeed logs={appState.filteredLogs} {fleet} {emptyStateMessage} />
				{/snippet}
			</Resizer>
		</div>
	{/if}

	<FooterBar
		showToggles={true}
		{showFriends}
		{showGroups}
		onToggleFriends={handleToggleFriends}
		onToggleGroups={handleToggleGroups}
		{appVersion}
	/>
</div>

