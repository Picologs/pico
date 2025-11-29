<script lang="ts">
	import GroupItem from './GroupItem.svelte';
	import type { GroupItemData } from './GroupItem.svelte';
	import Skeleton from './Skeleton.svelte';
	import { appState } from '../app.svelte.js';
	import Compass from '@lucide/svelte/icons/compass';

	interface Props {
		groups?: GroupItemData[];
		selectedGroupId?: string | null;
		selectedUserId?: string | null;
		isLoadingGroups?: boolean;
		loadingMembers?: Set<string>;
		discordCdnUrl?: string;
		onSelectUser?: (userId: string) => void;
		onFetchGroupMembers?: (groupId: string) => Promise<void>;
	}

	let {
		groups = [],
		selectedGroupId = $bindable(null),
		selectedUserId = null,
		isLoadingGroups = false,
		loadingMembers = new Set(),
		discordCdnUrl = 'https://cdn.discordapp.com',
		onSelectUser,
		onFetchGroupMembers
	}: Props = $props();

	// Sync expandedGroupId with selectedGroupId
	let expandedGroupId = $derived(selectedGroupId);

	// Track which groups have been fetched to prevent duplicate requests
	let fetchedGroups = $state(new Set<string>());

	// Auto-fetch members when a group becomes expanded (handles page load with active group)
	$effect(() => {
		if (expandedGroupId && onFetchGroupMembers && !fetchedGroups.has(expandedGroupId)) {
			const group = groups.find((g) => g.id === expandedGroupId);
			// Only fetch if group exists, has members expected, but no members loaded
			if (group && group.memberCount > 0 && (!group.members || group.members.length === 0)) {
				fetchedGroups.add(expandedGroupId);
				onFetchGroupMembers(expandedGroupId);
			}
		}
	});

	// Sort groups alphabetically
	let sortedGroups = $derived(
		[...groups]
			.filter((g) => g && g.id)
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	function handleToggleGroup(groupId: string) {
		// Toggle selection: if already selected, deselect and collapse
		if (selectedGroupId === groupId) {
			selectedGroupId = null;
			appState.setActiveGroupId(null);
			appState.addToast('Showing logs from all friends', 'info');

			// Refresh logs to show fresh data from all friends
			appState.refreshLogs();
		} else {
			selectedGroupId = groupId;
			appState.setActiveGroupId(groupId);

			// Clear friend selection (mutual exclusivity - only one filter at a time)
			appState.setActiveFriendId(null);

			// Show toast with group name and avatar
			const group = groups.find((g) => g.id === groupId);
			if (group) {
				// Determine if avatar is emoji or URL/hash
				const isEmoji = group.avatar && /^[\p{Emoji}\u200d]+$/u.test(group.avatar);
				const isUrl = group.avatar && (group.avatar.startsWith('http') || group.avatar.startsWith('/'));

				appState.addToast(`Showing logs from ${group.name}`, 'info', {
					customIcon: isEmoji ? group.avatar ?? undefined : undefined,
					avatarUrl: isUrl ? group.avatar ?? undefined : undefined
				});
			}

			// Fetch members if not already loaded
			if (onFetchGroupMembers && (!group?.members || group.members.length === 0)) {
				onFetchGroupMembers(groupId);
			}

			// Refresh logs to show fresh data for this group
			appState.refreshLogs();
		}
	}

	function handleSelectUser(userId: string) {
		if (onSelectUser) {
			onSelectUser(userId);
		}
	}
</script>

<!-- Groups Section -->
<div class="flex flex-col min-h-0 h-full">
	<!-- Scrollable Groups List -->
	<div class="scrollbar-custom flex-1 min-h-0 overflow-y-auto px-2">
		<h4 class="py-2 text-xs font-medium tracking-wide text-white/60 uppercase">
			Groups ({groups.length})
		</h4>

		{#if isLoadingGroups && groups.length === 0}
			<Skeleton count={2} />
		{:else if groups.length > 0}
			<div class="space-y-2 pb-2">
				{#each sortedGroups as group (group.id)}
					<GroupItem
						{group}
						isSelected={selectedGroupId === group.id}
						isExpanded={expandedGroupId === group.id}
						isLoadingMembers={loadingMembers.has(group.id)}
						{selectedUserId}
						currentUserId={appState.user?.discordId}
						{discordCdnUrl}
						onToggle={() => handleToggleGroup(group.id)}
						onSelectUser={handleSelectUser}
					/>
				{/each}
			</div>
		{:else}
			<div class="flex items-center justify-center py-8 text-sm text-white/40">
				No groups yet
			</div>
		{/if}
	</div>

	<!-- Discover Button (fixed at bottom) -->
	<div class="shrink-0 px-2 py-2">
		<a
			href="/discover"
			class="flex items-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
		>
			<Compass size={16} />
			<span>Discover Groups</span>
		</a>
	</div>
</div>
