<script lang="ts">
	/**
	 * LogList - Render list of log items with zebra striping
	 *
	 * Maps over logs array and renders each with LogItemGroup.
	 * Cross-player groups are rendered with LogItemCrossPlayerGroup.
	 * Provides zebra striping for better readability.
	 */

	import LogItemGroup from '../LogItemGroup.svelte';
	import LogItemCrossPlayerGroup from '../LogItemCrossPlayerGroup.svelte';
	import type { Log } from '@pico/types';
	import type { FleetDatabase } from '../../utils/ship-utils.js';

	let {
		logs,
		getUserDisplayName = undefined,
		fleet = undefined
	}: {
		/** Array of logs to display */
		logs: Log[];
		/** Optional function to get display name for a userId */
		getUserDisplayName?: (userId: string) => string | null;
		/** Fleet database for ship lookups */
		fleet?: FleetDatabase;
	} = $props();
</script>

{#each logs as log, index (log.id)}
	{#if log.eventType === 'cross_player_group'}
		<LogItemCrossPlayerGroup {log} {getUserDisplayName} {fleet} alternateBackground={index % 2 === 1} />
	{:else}
		<LogItemGroup {log} {getUserDisplayName} {fleet} alternateBackground={index % 2 === 1} />
	{/if}
{/each}
