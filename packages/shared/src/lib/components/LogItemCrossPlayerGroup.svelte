<script lang="ts">
	/**
	 * LogItemCrossPlayerGroup - Display grouped events witnessed by multiple players
	 *
	 * Shows a single event with stacked player avatars, expandable to see individual entries.
	 * Used when the same observable event (ship destroyed, player death, etc.) is
	 * witnessed by multiple group members simultaneously.
	 */

	import LogItem from './LogItem.svelte';
	import Avatar from './Avatar.svelte';
	import type { Log } from '@pico/types';
	import type { FleetDatabase } from '../utils/ship-utils.js';
	import { appState, hasMembers } from '../app.svelte.js';
	import { ChevronDown, ChevronRight } from '@lucide/svelte';

	let {
		log,
		getUserDisplayName = undefined,
		fleet = undefined,
		alternateBackground = false
	}: {
		/** The cross-player group log with children */
		log: Log;
		/** Optional function to get display name for a userId */
		getUserDisplayName?: (userId: string) => string | null;
		/** Fleet database for ship lookups */
		fleet?: FleetDatabase;
		/** Whether to apply alternating background color */
		alternateBackground?: boolean;
	} = $props();

	// Local state for open/closed
	let isOpen = $state(log.open ?? false);

	// Local state for tracking which children are open
	let childrenOpenState = $state<Record<string, boolean>>({});

	// Initialize children open state
	$effect(() => {
		if (log.children) {
			for (const child of log.children) {
				if (childrenOpenState[child.id] === undefined) {
					childrenOpenState[child.id] = child.open ?? false;
				}
			}
		}
	});

	// Get unique user IDs from metadata
	const userIds = $derived((log.metadata?.userIds as string[]) || []);
	const playerCount = $derived(userIds.length);

	// Look up avatar data for each user
	const avatarsData = $derived.by(() => {
		return userIds.map((userId) => {
			// Check if this is the current user
			if (appState.user && appState.user.discordId === userId) {
				return {
					userId,
					discordId: appState.user.discordId,
					avatar: appState.user.avatar ?? null
				};
			}

			// Try friends
			const friend = appState.friends.find((f) => f.friendDiscordId === userId);
			if (friend) {
				return {
					userId,
					discordId: friend.friendDiscordId,
					avatar: friend.friendAvatar
				};
			}

			// Try active group members
			if (appState.activeGroupId) {
				const group = appState.groups.find((g) => g.id === appState.activeGroupId);
				if (group && hasMembers(group)) {
					const member = group.members.find((m) => m.discordId === userId);
					if (member) {
						return {
							userId,
							discordId: member.discordId,
							avatar: member.avatar
						};
					}
				}
			}

			// Fallback
			return {
				userId,
				discordId: null,
				avatar: null
			};
		});
	});

	// Limit visible avatars (show max 5, then +N)
	const MAX_VISIBLE_AVATARS = 5;
	const visibleAvatars = $derived(avatarsData.slice(0, MAX_VISIBLE_AVATARS));
	const hiddenCount = $derived(Math.max(0, avatarsData.length - MAX_VISIBLE_AVATARS));

	// Check if this log has children
	const hasChildren = $derived(log.children && log.children.length > 0);

	// Get the original event type for styling
	const originalEventType = $derived(log.metadata?.originalEventType as string | undefined);

	// Determine gradient color based on original event type
	const gradientColor = $derived(
		originalEventType === 'actor_death' || originalEventType === 'destruction'
			? '239 68 68' // red
			: '96 165 250' // blue
	);

	function toggleOpen() {
		isOpen = !isOpen;
	}
</script>

<div class="w-full {alternateBackground ? 'bg-white/[0.02]' : ''}">
	<!-- Header row with avatars and event info -->
	<button
		class="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
		onclick={toggleOpen}
	>
		<!-- Expand/collapse icon -->
		<div class="flex-shrink-0 text-white/40">
			{#if isOpen}
				<ChevronDown size={16} />
			{:else}
				<ChevronRight size={16} />
			{/if}
		</div>

		<!-- Stacked avatars -->
		<div class="flex -space-x-2 flex-shrink-0">
			{#each visibleAvatars as avatarData (avatarData.userId)}
				<div class="ring-2 ring-bg-primary rounded-full">
					<Avatar
						discordId={avatarData.discordId}
						avatar={avatarData.avatar}
						userId={avatarData.userId}
						size={7}
						alt="Player avatar"
					/>
				</div>
			{/each}
			{#if hiddenCount > 0}
				<div
					class="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 ring-2 ring-bg-primary text-xs font-medium text-white/70"
				>
					+{hiddenCount}
				</div>
			{/if}
		</div>

		<!-- Event info -->
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2">
				<span class="text-lg">{log.emoji}</span>
				<span class="text-sm text-white/90 truncate">{log.line}</span>
			</div>
			<div class="text-xs text-white/50">
				Witnessed by {playerCount} player{playerCount !== 1 ? 's' : ''}
			</div>
		</div>
	</button>
</div>

<!-- Expanded children -->
{#if isOpen && hasChildren}
	<div
		class="relative pl-14 group-divider"
		style="--gradient-color: {gradientColor};"
	>
		{#each log.children as child (child.id)}
			{@const childUsername = getUserDisplayName ? getUserDisplayName(child.userId) : null}
			<LogItem
				{...child}
				bind:open={childrenOpenState[child.id]}
				{fleet}
				child={true}
				reportedBy={childUsername ? [childUsername] : undefined}
			/>
		{/each}
	</div>
{/if}

<style>
	.group-divider {
		position: relative;

		&::before {
			content: '';
			position: absolute;
			left: 31px;
			top: 0;
			bottom: 0;
			width: 2px;
			background: linear-gradient(
				to bottom,
				rgba(var(--gradient-color) / 0.6),
				rgba(var(--gradient-color) / 0)
			);
			border-radius: 2px;
			opacity: 1;
			pointer-events: none;
			z-index: 0;
		}
	}
</style>
