<script lang="ts">
	/**
	 * LogItemText - Display formatted log text based on event type
	 *
	 * Handles all the different event types and formats them appropriately.
	 * Includes helper functions for name checking and text formatting.
	 */

	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import type { Log } from '@pico/types';

	let {
		eventType = undefined,
		line,
		metadata = undefined,
		player,
		isOpen = false,
		isChild = false
	}: {
		/** Type of log event */
		eventType?: Log['eventType'];
		/** Formatted log line text */
		line: string;
		/** Additional metadata for the log */
		metadata?: Log['metadata'];
		/** Player name */
		player: string | null;
		/** Whether the log item is expanded */
		isOpen?: boolean;
		/** Whether this is a child item (smaller font) */
		isChild?: boolean;
	} = $props();

	function convertCamelCaseToWords(str: string) {
		return str
			?.replace(/([A-Z])/g, ' $1')
			?.replace(/^./, function (str) {
				return str.toUpperCase();
			})
			?.toLowerCase();
	}

	function checkVictimName(victimName?: string | null) {
		if (!victimName) {
			return 'unknown';
		}
		if (victimName.includes('kopion')) {
			return 'Kopion';
		}
		if (['PU_Human', '_NPC_'].includes(victimName)) {
			return 'NPC';
		}
		return victimName;
	}
</script>

{#if eventType === 'actor_death' && metadata?.damageType === 'SelfDestruct'}
	{@const zone = metadata.zone?.split('_').slice(0, -1).join(' ')}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base'}">
		{checkVictimName(metadata.victimName)} was killed when the {#if zone && zone != 'Unknown'}{zone}{:else}ship{/if}
		was self destructed {#if metadata.killerName && metadata.killerName != 'unknown'}by {checkVictimName(
				metadata.killerName
			)}{/if}
	</div>
{:else if eventType === 'actor_death' && metadata?.damageType === 'Suicide'}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base'}">
		{checkVictimName(metadata?.victimName)} committed suicide
	</div>
{:else if eventType === 'actor_death' && metadata?.deathCause === 'vehicle_destruction'}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base'}">
		{checkVictimName(metadata?.victimName)} was killed when their {#if metadata?.zone && metadata.zone != 'Unknown'}{metadata.zone}{:else}ship{/if} was destroyed
	</div>
{:else if eventType === 'actor_death'}
	{@const weapon = metadata?.weaponClass?.replace('_', ' ')}
	{@const zone = metadata?.zone?.split('_')?.slice(0, -1)?.join(' ')}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base'}">
		{checkVictimName(metadata?.victimName)} was killed {#if zone && zone != 'Unknown'}
			while in {zone}{/if} by {checkVictimName(metadata?.killerName) || 'unknown'}
		{#if weapon && weapon != 'unknown'}using
			{weapon}{/if}
		{#if metadata?.damageType && metadata.damageType != 'unknown'}
			caused by {convertCamelCaseToWords(metadata.damageType)}{/if}
	</div>
{:else if eventType === 'vehicle_control_flow'}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base'}">
		{line}
	</div>
{:else if eventType === 'killing_spree'}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base font-bold text-danger'}">
		{line}
	</div>
{:else if eventType === 'crash_death_group'}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base'}">
		{line}
	</div>
{:else if eventType === 'location_change'}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base'}">
		{player} requested inventory in {metadata?.location?.split('_').join(' ') || 'unknown location'}
	</div>
{:else if eventType === 'system_quit'}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base'}">
		{player} left the game
	</div>
{:else}
	<div class="{isOpen ? '' : 'truncate'} {isChild ? 'text-xs' : 'text-base'}">{line}</div>
{/if}
