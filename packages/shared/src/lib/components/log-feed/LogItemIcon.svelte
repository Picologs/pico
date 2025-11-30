<script lang="ts">
	/**
	 * LogItemIcon - Display icon for log items
	 *
	 * Shows emoji, ship image, or ShipIcon SVG depending on event type.
	 * Handles size variations for child vs parent items.
	 * For killing sprees from friends/group members: shows avatar with pulsing red glow.
	 */

	import ShipIcon from './ShipIcon.svelte';
	import Avatar from '../Avatar.svelte';
	import type { Log } from '@pico/types';
	import type { FleetDatabase } from '../../utils/ship-utils.js';
	import { getShipData, getShipImageUrl } from '../../utils/ship-utils.js';
	import { appState, hasMembers } from '../../app.svelte.js';

	let {
		emoji,
		eventType = undefined,
		metadata = undefined,
		fleet = undefined,
		isChild = false,
		userId = undefined
	}: {
		/** Emoji to display */
		emoji: string;
		/** Event type to determine if ship icon should be used */
		eventType?: Log['eventType'];
		/** Metadata containing vehicle information */
		metadata?: Log['metadata'];
		/** Fleet database for ship lookups (optional) */
		fleet?: FleetDatabase;
		/** Whether this is a child item (smaller size) */
		isChild?: boolean;
		/** User ID for avatar lookup (killing sprees) */
		userId?: string;
	} = $props();

	const shouldUseShipIcon = $derived(
		eventType === 'vehicle_control_flow' ||
		eventType === 'destruction' ||
		eventType === 'vehicle_control_group' ||
		eventType === 'fatal_collision' ||
		eventType === 'crash_death_group' ||
		eventType === 'quantum_arrival' ||
		eventType === 'landing_pad' ||
		(eventType === 'actor_death' && metadata?.deathCause === 'vehicle_destruction')
	);

	// Get ship data and image URL using ship-utils
	// For death-by-vehicle-destruction, ship name is in metadata.zone instead of vehicleName
	const shipData = $derived(
		fleet && (metadata?.vehicleName || (eventType === 'actor_death' && metadata?.deathCause === 'vehicle_destruction' && metadata?.zone))
			? getShipData(metadata.vehicleName || metadata.zone || '', fleet)
			: null
	);

	const shipImageUrl = $derived(shipData ? getShipImageUrl(shipData) : null);

	let imageError = $state(false);
	const isHardDeath = $derived(
		(eventType === 'destruction' && metadata?.destroyLevelTo === '2') ||
		(eventType === 'actor_death' && metadata?.deathCause === 'vehicle_destruction') ||
		eventType === 'fatal_collision' ||
		eventType === 'crash_death_group'
	);

	// Death by vehicle destruction, fatal collision, or crash-death group detection
	const isDeathByVehicle = $derived(
		(eventType === 'actor_death' && metadata?.deathCause === 'vehicle_destruction') ||
		eventType === 'fatal_collision' ||
		eventType === 'crash_death_group'
	);

	// Killing spree avatar logic - using $derived.by() for proper reactivity tracking
	const shouldShowAvatar = $derived(eventType === 'killing_spree' && userId && !isChild);

	// Death avatar logic - show avatar only for actual deaths, not standalone crashes
	const shouldShowDeathAvatar = $derived(
		((eventType === 'actor_death' && metadata?.deathCause === 'vehicle_destruction') ||
			eventType === 'crash_death_group') &&
		userId &&
		!isChild
	);

	// Vehicle control avatar logic - show avatar for ship entry events
	const shouldShowVehicleAvatar = $derived(
		(eventType === 'vehicle_control_flow' || eventType === 'vehicle_control_group') &&
		userId &&
		!isChild
	);

	const avatarData = $derived.by(() => {
		if (!shouldShowAvatar) return null;

		// Check if this is the current user first (direct access for reactivity)
		if (appState.user && appState.user.discordId === userId) {
			return {
				discordId: appState.user.discordId,
				avatar: appState.user.avatar ?? null
			};
		}

		// Try friends (direct access for reactivity)
		const friend = appState.friends.find((f) => f.friendDiscordId === userId);
		if (friend) {
			return {
				discordId: friend.friendDiscordId,
				avatar: friend.friendAvatar
			};
		}

		// Try active group members (direct access for reactivity)
		if (appState.activeGroupId) {
			const group = appState.groups.find((g) => g.id === appState.activeGroupId);
			if (group && hasMembers(group)) {
				const member = group.members.find(m => m.discordId === userId);
				if (member) {
					return {
						discordId: member.discordId,
						avatar: member.avatar
					};
				}
			}
		}

		return null;
	});

	const hasAvatar = $derived(avatarData && (avatarData.discordId || avatarData.avatar));

	// Death avatar data - same lookup logic for death events
	const deathAvatarData = $derived.by(() => {
		if (!shouldShowDeathAvatar) return null;

		// Check if this is the current user first (direct access for reactivity)
		if (appState.user && appState.user.discordId === userId) {
			return {
				discordId: appState.user.discordId,
				avatar: appState.user.avatar ?? null
			};
		}

		// Try friends (direct access for reactivity)
		const friend = appState.friends.find((f) => f.friendDiscordId === userId);
		if (friend) {
			return {
				discordId: friend.friendDiscordId,
				avatar: friend.friendAvatar
			};
		}

		// Try active group members (direct access for reactivity)
		if (appState.activeGroupId) {
			const group = appState.groups.find((g) => g.id === appState.activeGroupId);
			if (group && hasMembers(group)) {
				const member = group.members.find(m => m.discordId === userId);
				if (member) {
					return {
						discordId: member.discordId,
						avatar: member.avatar
					};
				}
			}
		}

		return null;
	});

	const hasDeathAvatar = $derived(deathAvatarData && (deathAvatarData.discordId || deathAvatarData.avatar));

	// Vehicle control avatar data - same lookup logic for vehicle entry events
	const vehicleAvatarData = $derived.by(() => {
		if (!shouldShowVehicleAvatar) return null;

		// Check if this is the current user first (direct access for reactivity)
		if (appState.user && appState.user.discordId === userId) {
			return {
				discordId: appState.user.discordId,
				avatar: appState.user.avatar ?? null
			};
		}

		// Try friends (direct access for reactivity)
		const friend = appState.friends.find((f) => f.friendDiscordId === userId);
		if (friend) {
			return {
				discordId: friend.friendDiscordId,
				avatar: friend.friendAvatar
			};
		}

		// Try active group members (direct access for reactivity)
		if (appState.activeGroupId) {
			const group = appState.groups.find((g) => g.id === appState.activeGroupId);
			if (group && hasMembers(group)) {
				const member = group.members.find(m => m.discordId === userId);
				if (member) {
					return {
						discordId: member.discordId,
						avatar: member.avatar
					};
				}
			}
		}

		return null;
	});

	const hasVehicleAvatar = $derived(vehicleAvatarData && (vehicleAvatarData.discordId || vehicleAvatarData.avatar));
</script>

{#if eventType === 'killing_spree' && hasAvatar && !isChild}
	<!-- Avatar with flame emoji overlay and pulsing red glow for friends/group members -->
	<div class="relative flex items-center justify-center h-10 w-10">
		<div class="avatar-spree-glow">
			<Avatar
				discordId={avatarData!.discordId}
				avatar={avatarData!.avatar}
				userId={userId}
				size={10}
				showOnline={false}
				borderClass="ring-2 ring-danger"
			/>
		</div>
		<!-- Flame emoji overlay (bottom-right corner) -->
		<div class="absolute -bottom-1 -right-1 text-lg">
			{emoji}
		</div>
	</div>
{:else if shouldUseShipIcon && shipImageUrl && !imageError}
	<div
		class="relative flex items-center justify-center overflow-visible {isChild
			? 'h-4 min-h-4 w-4'
			: 'h-10 min-h-10 w-10'}"
	>
		{#if isHardDeath}
			<!-- Split ship image for hard death -->
			<img
				src={shipImageUrl}
				alt={metadata?.vehicleName || 'Vehicle'}
				class="absolute top-0 left-0 {isChild
					? 'h-4 w-4'
					: 'h-10 w-10'} max-w-full -translate-x-[0.25rem] -rotate-[15deg] object-contain object-center opacity-90 [filter:drop-shadow(2px_2px_0_rgba(0,0,0,0.4))_brightness(2)_saturate(1)] [clip-path:polygon(0_0,50%_0,50%_100%,0%_100%)]"
				onerror={() => (imageError = true)}
			/>
			<img
				src={shipImageUrl}
				alt={metadata?.vehicleName || 'Vehicle'}
				class="absolute top-0 left-0 {isChild
					? 'h-4 w-4'
					: 'h-10 w-10'} max-w-full translate-x-[0.25rem] rotate-[15deg] object-contain object-center opacity-90 [filter:drop-shadow(2px_2px_0_rgba(0,0,0,0.4))_brightness(2)_saturate(1)] [clip-path:polygon(50%_0,100%_0,100%_100%,50%_100%)]"
			/>
		{:else}
			<img
				src={shipImageUrl}
				alt={metadata?.vehicleName || 'Vehicle'}
				class="absolute top-0 left-0 {isChild
					? 'hidden h-4 w-4'
					: 'h-10 w-10'} max-w-full object-contain object-center [filter:drop-shadow(2px_2px_0_rgba(0,0,0,0.4))_brightness(2)_saturate(1)]"
				onerror={() => (imageError = true)}
			/>
		{/if}
		{#if eventType === 'destruction'}
			<div
				class="absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center {isChild
					? 'text-xs'
					: 'text-2xl'}"
			>
				{emoji}
			</div>
		{/if}
		{#if eventType === 'quantum_arrival'}
			<!-- Eyes emoji overlay (bottom-right corner) for quantum arrivals -->
			<div class="absolute -bottom-1 -right-1 z-10 {isChild ? 'text-xs' : 'text-lg'}">
				{emoji}
			</div>
		{/if}
		{#if (eventType === 'vehicle_control_flow' || eventType === 'vehicle_control_group') && hasVehicleAvatar}
			<!-- Avatar overlay for vehicle control (ship entry) events -->
			<div class="absolute -bottom-1 -right-1 z-20">
				<Avatar
					discordId={vehicleAvatarData!.discordId}
					avatar={vehicleAvatarData!.avatar}
					userId={userId}
					size={6}
					showOnline={false}
				/>
			</div>
		{/if}
		{#if isDeathByVehicle}
			<!-- Explosion emoji for death by vehicle destruction -->
			<div
				class="absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center {isChild
					? 'text-xs'
					: 'text-2xl'}"
			>
				💥
			</div>
			{#if hasDeathAvatar}
				<!-- Greyscale avatar overlay for player/friend/group member deaths -->
				<div class="absolute -bottom-1 -right-1 z-20">
					<Avatar
						discordId={deathAvatarData!.discordId}
						avatar={deathAvatarData!.avatar}
						userId={userId}
						size={6}
						showOnline={false}
						class="opacity-80"
					/>
				</div>
			{/if}
		{/if}
	</div>
{:else if shouldUseShipIcon}
	<div class="flex items-center justify-center {isChild ? 'h-4 w-4 text-xs' : 'h-10 w-10 text-2xl'}">
		<ShipIcon size={isChild ? 12 : 24} class="text-white/70" />
	</div>
{:else}
	<div class="flex items-center justify-center {isChild ? 'h-4 w-4 text-xs' : 'h-10 w-10 text-2xl'}">{emoji}</div>
{/if}

<style>
	.avatar-spree-glow {
		border-radius: 50%;
	}
</style>
