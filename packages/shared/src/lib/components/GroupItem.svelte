<script lang="ts">
	import Avatar from './Avatar.svelte';
	import Skeleton from './Skeleton.svelte';
	import { SvelteMap, SvelteDate } from 'svelte/reactivity';
	import { UserPlus, Loader2 } from '@lucide/svelte';
	import type { GroupMember, Friend } from '@pico/types';
	import { appState } from '../app.svelte';

	export interface GroupItemData {
		id: string;
		name: string;
		avatar?: string | null;
		memberCount: number;
		memberRole?: 'owner' | 'admin' | 'member';
		tags?: string[];
		members?: GroupMember[];
		visibility?: 'private' | 'discoverable';
		joinMethod?: 'open' | 'request';
		pendingJoinRequestCount?: number;
	}

	interface Props {
		group: GroupItemData;
		isSelected?: boolean;
		isExpanded?: boolean;
		isLoadingMembers?: boolean;
		selectedUserId?: string | null;
		currentUserId?: string;
		discordCdnUrl?: string;
		onToggle?: () => void;
		onSelectUser?: (userId: string) => void;
	}

	let {
		group,
		isSelected = false,
		isExpanded = false,
		isLoadingMembers = false,
		selectedUserId = null,
		currentUserId,
		discordCdnUrl = 'https://cdn.discordapp.com',
		onToggle,
		onSelectUser
	}: Props = $props();

	// Reactive date for time display - updates every minute
	const now = new SvelteDate();
	$effect(() => {
		const interval = setInterval(() => {
			now.setTime(Date.now());
		}, 60000);
		return () => clearInterval(interval);
	});

	// Sort group members: current user first, then by role, then online status, then alphabetically (with deduplication)
	let allSortedMembers = $derived(
		group.members
			? Array.from(
					new SvelteMap(
						[...group.members]
							.filter((m) => m && m.userId && m.discordId)
							.map((m) => [m.userId, m])
					).values()
				).sort((a, b) => {
					// Current user always first
					if (currentUserId && a.discordId && b.discordId) {
						if (a.discordId === currentUserId && b.discordId !== currentUserId) return -1;
						if (a.discordId !== currentUserId && b.discordId === currentUserId) return 1;
					}

					// Then sort by role (owner > admin > member)
					const roleOrder = { owner: 0, admin: 1, member: 2 };
					const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
					const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
					if (aOrder !== bOrder) return aOrder - bOrder;

					// Then online status
					if (a.isOnline && !b.isOnline) return -1;
					if (!a.isOnline && b.isOnline) return 1;

					// Finally alphabetically by display name (with null safety)
					const aName = a.displayName || '';
					const bName = b.displayName || '';
					return aName.localeCompare(bName);
				})
			: []
	);

	// Limit display to first 10 members
	let sortedMembers = $derived(allSortedMembers.slice(0, 10));

	// Check if there are more members to show
	let hasMoreMembers = $derived(group.memberCount > 10);

	// Get local time for a member (reactive via SvelteDate)
	function getLocalTime(timezone: string | undefined): string {
		if (!timezone) return '';
		try {
			return now.toLocaleTimeString('en-US', {
				timeZone: timezone,
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return '';
		}
	}

	// Get city name from timezone
	function getCityFromTimezone(timezone: string | undefined): string {
		if (!timezone) return '';
		const parts = timezone.split('/');
		let location = parts[parts.length - 1];
		if (parts.length > 1 && parts[0] === 'Australia') {
			location = parts.join(', ');
		} else if (parts.length > 2) {
			location = parts.slice(-2).join(', ');
		}
		return location.replace(/_/g, ' ');
	}

	function handleSelectUser(userId: string) {
		if (onSelectUser) {
			onSelectUser(userId);
		}
	}

	// State for tracking in-progress friend requests
	let sendingFriendRequest = $state<Set<string>>(new Set());

	// Pending join requests count (for owners/admins of discoverable groups)
	let pendingRequestCount = $derived(
		(group.memberRole === 'owner' || group.memberRole === 'admin') &&
		group.visibility === 'discoverable' &&
		group.joinMethod === 'request'
			? appState.getJoinRequestCount(group.id)
			: 0
	);

	// Derived values for friend checking
	const friends = $derived(appState.friends);
	const friendRequests = $derived(appState.friendRequests);

	function canSendFriendRequest(member: GroupMember): boolean {
		if (!currentUserId || member.discordId === currentUserId) {
			return false;
		}

		const isFriend = friends.some((f: Friend) => f.friendDiscordId === member.discordId);
		if (isFriend) {
			return false;
		}

		const hasIncomingRequest = friendRequests.incoming.some(
			(r) => r.fromDiscordId === member.discordId
		);
		if (hasIncomingRequest) {
			return false;
		}

		const hasOutgoingRequest = friendRequests.outgoing.some(
			(r) => r.fromDiscordId === member.discordId
		);
		if (hasOutgoingRequest) {
			return false;
		}

		return true;
	}

	async function handleSendFriendRequest(e: Event, member: GroupMember) {
		e.stopPropagation(); // Prevent triggering member selection
		if (sendingFriendRequest.has(member.discordId)) {
			return;
		}

		sendingFriendRequest = new Set(sendingFriendRequest).add(member.discordId);

		try {
			await appState.sendFriendRequestByDiscordId(member.discordId);
		} finally {
			const newSet = new Set(sendingFriendRequest);
			newSet.delete(member.discordId);
			sendingFriendRequest = newSet;
		}
	}
</script>

<div
	class="flex flex-col transition-colors {isSelected && isExpanded
		? 'rounded-lg ring-2 ring-discord'
		: ''}"
>
	<button
		class="group-card sticky top-0 z-10 flex items-center gap-2 bg-secondary px-2 py-2 hover:bg-white/10 {isSelected &&
		isExpanded
			? 'selected rounded-t-lg'
			: isSelected
				? 'selected rounded-lg ring-2 ring-discord'
				: 'rounded-lg'} transition-colors"
		onclick={onToggle}
	>
		{#if group.avatar && (group.avatar.startsWith('http') || group.avatar.startsWith('/uploads'))}
			<img
				src={group.avatar}
				alt={group.name}
				class="h-8 w-8 flex-shrink-0 rounded-full object-cover"
			/>
		{:else}
			<div class="flex-shrink-0 text-2xl leading-none">
				{group.avatar || '🗂️'}
			</div>
		{/if}
		<div class="flex min-w-0 flex-1 flex-col items-start gap-1">
			<div class="flex w-full items-center gap-2">
				<span class="truncate text-sm font-medium text-white">
					{group.name}
				</span>
				{#if group.memberRole === 'owner'}
					<span class="flex-shrink-0 text-[10px] tracking-wider text-[#ff9800]/80 uppercase">
						Owner
					</span>
				{:else if group.memberRole === 'admin'}
					<span class="flex-shrink-0 text-[10px] tracking-wider text-discord/80 uppercase">
						Admin
					</span>
				{/if}
				{#if pendingRequestCount > 0}
					<span class="flex h-4 min-w-4 items-center justify-center rounded-full bg-discord px-1 text-[10px] font-medium text-white" title="{pendingRequestCount} pending join {pendingRequestCount === 1 ? 'request' : 'requests'}">
						{pendingRequestCount}
					</span>
				{/if}
			</div>
			<div class="flex w-full items-center gap-1 overflow-hidden">
				{#if group.tags && group.tags.length > 0}
					<div class="flex min-w-0 flex-shrink items-center gap-1 overflow-hidden">
						{#each group.tags as tag (tag)}
							<span class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-white/60">
								{tag}
							</span>
						{/each}
					</div>
				{/if}
				<span class="flex-shrink-0 text-xs whitespace-nowrap text-white/40">
					{group.memberCount}
					{group.memberCount === 1 ? 'member' : 'members'}
				</span>
			</div>
		</div>
	</button>

	{#if isExpanded}
		{#if isLoadingMembers || (sortedMembers.length === 0 && group.memberCount > 0)}
			<!-- Loading members (either explicitly loading or expanded but not loaded yet) -->
			<div class="flex flex-col rounded-b-lg bg-black/20 p-2">
				<Skeleton count={Math.min(Math.max(group.memberCount, 1), 10)} />
			</div>
		{:else if sortedMembers.length > 0}
			<div class="flex flex-col rounded-b-lg bg-black/20">
				{#each sortedMembers as member (member.userId)}
					<div
						role="button"
						tabindex="0"
						onclick={() => handleSelectUser(member.userId)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleSelectUser(member.userId);
							}
						}}
						class="flex w-full min-w-0 cursor-pointer items-center gap-2 px-2 py-2 transition-colors hover:bg-white/[0.08] {selectedUserId ===
						member.userId
							? 'bg-white/10'
							: ''} {!member.isOnline ? 'opacity-50' : ''}"
					>
						<Avatar
							avatar={member.avatar}
							discordId={member.discordId}
							userId={member.userId}
							alt={member.displayName || 'User avatar'}
							size={8}
							showOnline={true}
							isOnline={member.isOnline}
							{discordCdnUrl}
						/>
						<div class="flex min-w-0 flex-1 flex-col items-start overflow-hidden">
							<span class="max-w-full truncate text-left text-sm font-medium text-white">
								{#if member.discordId === appState.user?.discordId}
									{appState.displayName || member.displayName || 'Unknown player'}
								{:else}
									{member.displayName || 'Unknown player'}
								{/if}
							</span>
							{#if member.timeZone}
								<span class="max-w-full truncate text-left text-xs text-white/40" title={member.timeZone}>
									{getLocalTime(member.timeZone)} · {getCityFromTimezone(member.timeZone)}
								</span>
							{/if}
						</div>
						{#if canSendFriendRequest(member)}
							<button
								type="button"
								onclick={(e) => handleSendFriendRequest(e, member)}
								disabled={sendingFriendRequest.has(member.discordId)}
								class="ml-auto flex-shrink-0 rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
								title="Send friend request"
							>
								{#if sendingFriendRequest.has(member.discordId)}
									<Loader2 size={14} class="animate-spin" />
								{:else}
									<UserPlus size={14} />
								{/if}
							</button>
						{/if}
					</div>
				{/each}

				{#if hasMoreMembers}
					<div class="border-t border-white/10 px-2 py-2 text-center text-xs text-white/40">
						Showing first 10 of {group.memberCount} members
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
