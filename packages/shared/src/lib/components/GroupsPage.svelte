<script lang="ts">
	import {
		Users,
		Plus,
		Settings,
		Trash2,
		LogOut,
		UserPlus,
		X,
		Search,
		Check,
		Star,
		StarOff,
		Loader2,
		Globe,
		Lock,
		Clock
	} from '@lucide/svelte';
	import Avatar from './Avatar.svelte';
	import PageLayout from './PageLayout.svelte';
	import Dialog from './Dialog.svelte';
	import Skeleton from './Skeleton.svelte';
	import ImageUpload from './ImageUpload.svelte';
	import { appState } from '../app.svelte.js';

	import type { Group, GroupMember, GroupInvitation, Friend, GroupVisibility, GroupJoinMethod, GroupJoinRequest } from '@pico/types';

	// Data from appState
	const groups = $derived(appState.groups);
	const friends = $derived(appState.friends);
	const currentUserId = $derived(appState.user?.discordId ?? '');

	// Sort groups alphabetically
	let sortedGroups = $derived(
		[...groups]
			.filter((g) => g && g.id)
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	// Group invitations from appState
	// Note: Using empty array for now - group invitations should come from appState.groupInvitations
	const invitations = $derived(appState.groupInvitations || []);

	// Loading state for group members
	let loadingMembers = $state<Set<string>>(new Set());

	// Track previous member counts to detect changes
	let previousMemberCounts = $state<Map<string, number>>(new Map());

	// Watch for member count changes in groups (indicates member added/removed)
	$effect(() => {
		// Check each group for member count changes
		groups.forEach((group) => {
			const prevCount = previousMemberCounts.get(group.id);
			const currentCount = group.memberCount;

			// If count changed and members are loaded for this group, refresh them
			if (
				prevCount !== undefined &&
				prevCount !== currentCount &&
				group.members &&
				group.members.length > 0
			) {
				if (appState.fetchGroupMembers) {
					appState.fetchGroupMembers(group.id);
				}
			}

			// Update tracked count
			previousMemberCounts.set(group.id, currentCount);
		});
	});

	// Member role handlers
	async function onRemoveMember(groupId: string, memberId: string) {
		await appState.removeMemberFromGroup(groupId, memberId);
		// Refresh members list
		if (appState.fetchGroupMembers) {
			await appState.fetchGroupMembers(groupId);
		}
	}

	async function onPromoteMember(groupId: string, memberId: string) {
		await appState.updateMemberRole(groupId, memberId, 'admin');
		// Refresh members list
		if (appState.fetchGroupMembers) {
			await appState.fetchGroupMembers(groupId);
		}
	}

	async function onDemoteMember(groupId: string, memberId: string) {
		await appState.updateMemberRole(groupId, memberId, 'member');
		// Refresh members list
		if (appState.fetchGroupMembers) {
			await appState.fetchGroupMembers(groupId);
		}
	}

	// UI State
	let showCreateDialog = $state(false);
	let showEditDialog = $state(false);
	let showInviteDialog = $state(false);
	let showDeleteDialog = $state(false);
	let selectedGroupId = $state<string | null>(null);
	let expandedGroupId = $state<string | null>(null);

	// Form state
	let groupName = $state('');
	let groupDescription = $state('');
	let groupAvatar = $state('');
	let groupTags = $state('');
	let groupVisibility = $state<GroupVisibility>('private');
	let groupJoinMethod = $state<GroupJoinMethod>('request');
	let deleteConfirmation = $state('');

	// Join requests state
	let showJoinRequestsDialog = $state(false);
	let joinRequestsGroupId = $state<string | null>(null);
	let loadingJoinRequests = $state(false);
	let reviewingRequest = $state<string | null>(null);

	// Loading states
	let creating = $state(false);
	let updating = $state(false);
	let deleting = $state(false);
	let inviting = $state(false);

	// Invite dialog state (stores Discord IDs)
	let selectedFriendIds = $state<Set<string>>(new Set());
	let friendSearchQuery = $state('');


	// Get pending invitations count
	let pendingInvitationsCount = $derived(
		invitations.filter((inv: GroupInvitation) => inv.status === 'pending').length
	);

	// Get sorted members for a group
	function getSortedMembers(groupId: string): GroupMember[] {
		const group = groups.find((g) => g.id === groupId);
		const members = group?.members || [];

		// Ensure we have a valid array before attempting to spread/sort
		if (!Array.isArray(members)) {
			return [];
		}

		return [...members].sort((a, b) => {
			// Owner first, then admins, then members
			const roleOrder = { owner: 0, admin: 1, member: 2 };
			const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
			const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
			if (aOrder !== bOrder) return aOrder - bOrder;

			// Online members first
			if (a.isOnline && !b.isOnline) return -1;
			if (!a.isOnline && b.isOnline) return 1;

			// Then sort by name
			const aName = a.displayName || 'Unknown';
			const bName = b.displayName || 'Unknown';
			return aName.localeCompare(bName);
		});
	}

	// Get selected group
	let selectedGroup = $derived(
		selectedGroupId ? groups.find((g: Group) => g.id === selectedGroupId) : null
	);

	// Open create dialog
	function openCreateDialog() {
		groupName = '';
		groupDescription = '';
		groupAvatar = '';
		groupTags = '';
		groupVisibility = 'private';
		groupJoinMethod = 'request';
		showCreateDialog = true;
	}

	// Open edit dialog
	function openEditDialog(group: Group) {
		selectedGroupId = group.id;
		groupName = group.name;
		groupDescription = group.description || '';
		groupAvatar = group.avatar || '';
		groupTags = group.tags?.join(', ') || '';
		groupVisibility = (group as any).visibility || 'private';
		groupJoinMethod = (group as any).joinMethod || 'request';
		showEditDialog = true;
	}

	// Open invite dialog
	function openInviteDialog(groupId: string) {
		selectedGroupId = groupId;
		selectedFriendIds = new Set();
		friendSearchQuery = '';
		showInviteDialog = true;
	}

	// Open delete dialog
	function openDeleteDialog(groupId: string) {
		selectedGroupId = groupId;
		deleteConfirmation = '';
		showDeleteDialog = true;
	}

	// Create group
	async function handleCreateGroup() {
		if (!groupName.trim()) {
			appState.addToast('Group name is required', 'error');
			return;
		}

		creating = true;
		try {
			const tags = groupTags
				.split(',')
				.map((t) => t.trim())
				.filter((t) => t.length > 0);

			await appState.createGroup({
				name: groupName.trim(),
				description: groupDescription.trim() || undefined,
				avatar: groupAvatar.trim() || undefined,
				tags: tags.length > 0 ? tags : undefined,
				visibility: groupVisibility,
				joinMethod: groupJoinMethod
			} as any);

			showCreateDialog = false;
		} catch (error) {
			// Error toast is already shown by appState.createGroup
			console.error('Create group error:', error);
		} finally {
			creating = false;
		}
	}

	// Update group
	async function handleUpdateGroup() {
		if (!selectedGroupId) return;
		if (!groupName.trim()) {
			appState.addToast('Group name is required', 'error');
			return;
		}

		updating = true;
		try {
			const tags = groupTags
				.split(',')
				.map((t) => t.trim())
				.filter((t) => t.length > 0);

			await appState.updateGroupData({
				groupId: selectedGroupId,
				name: groupName.trim(),
				description: groupDescription.trim() || undefined,
				avatar: groupAvatar.trim() || undefined,
				tags: tags.length > 0 ? tags : undefined,
				visibility: groupVisibility,
				joinMethod: groupJoinMethod
			} as any);

			showEditDialog = false;
		} catch (error) {
			// Error toast is already shown by appState.updateGroupData
			console.error('Update group error:', error);
		} finally {
			updating = false;
		}
	}

	// Delete group
	async function handleDeleteGroup() {
		if (!selectedGroupId) return;

		deleting = true;
		try {
			await appState.deleteGroup(selectedGroupId);
			showDeleteDialog = false;
			selectedGroupId = null;
			expandedGroupId = null;
			appState.setActiveGroupId(null);
		} catch (error) {
			// Error toast is already shown by appState.deleteGroup
			console.error('Delete group error:', error);
		} finally {
			deleting = false;
		}
	}

	// Leave group
	async function handleLeaveGroup(groupId: string) {
		try {
			await appState.leaveGroup(groupId);
			if (expandedGroupId === groupId) {
				expandedGroupId = null;
				appState.setActiveGroupId(null);
			}
		} catch (error) {
			// Error toast is already shown by appState.leaveGroup
			console.error('Leave group error:', error);
		}
	}

	// Toggle friend selection
	function toggleFriendSelection(friendDiscordId: string) {
		const newSet = new Set(selectedFriendIds);
		if (newSet.has(friendDiscordId)) {
			newSet.delete(friendDiscordId);
		} else {
			newSet.add(friendDiscordId);
		}
		selectedFriendIds = newSet;
	}

	// Invite selected friends
	async function handleInviteFriends() {
		if (!selectedGroupId || selectedFriendIds.size === 0) return;

		inviting = true;
		try {
			// Send invites for all selected friends and collect results
			const results = await Promise.allSettled(
				Array.from(selectedFriendIds).map((friendDiscordId) =>
					appState.inviteFriendToGroup(selectedGroupId!, friendDiscordId)
				)
			);

			// Count successes and failures
			const successes = results.filter((r) => r.status === 'fulfilled').length;
			const failures = results.filter((r) => r.status === 'rejected').length;

			// Show summary notification (individual toasts already shown)
			if (successes > 0 && failures > 0) {
				appState.addToast(
					`${successes} invitation${successes > 1 ? 's' : ''} sent, ${failures} failed`,
					'info'
				);
			}

			selectedFriendIds = new Set();
		} catch (error) {
			console.error('Invite friends error:', error);
		} finally {
			inviting = false;
		}
	}

	// Remove member
	async function handleRemoveMember(groupId: string, memberId: string) {
		try {
			await onRemoveMember(groupId, memberId);
		} catch (error) {
			console.error('Remove member error:', error);
		}
	}

	// Promote member to admin
	async function handlePromoteMember(groupId: string, memberId: string) {
		try {
			await onPromoteMember(groupId, memberId);
		} catch (error) {
			console.error('Promote member error:', error);
		}
	}

	// Demote member to regular member
	async function handleDemoteMember(groupId: string, memberId: string) {
		try {
			await onDemoteMember(groupId, memberId);
		} catch (error) {
			console.error('Demote member error:', error);
		}
	}

	// Accept invitation
	async function handleAcceptInvitation(invitationId: string) {
		try {
			await appState.acceptGroupInvitation(invitationId);
		} catch (error) {
			console.error('Accept invitation error:', error);
		}
	}

	// Deny invitation
	async function handleDenyInvitation(invitationId: string) {
		try {
			await appState.denyGroupInvitation(invitationId);
		} catch (error) {
			console.error('Deny invitation error:', error);
		}
	}

	// Open join requests dialog for a group
	async function openJoinRequestsDialog(groupId: string) {
		joinRequestsGroupId = groupId;
		loadingJoinRequests = true;
		showJoinRequestsDialog = true;

		try {
			await appState.fetchJoinRequests(groupId);
		} catch (error) {
			console.error('Fetch join requests error:', error);
		} finally {
			loadingJoinRequests = false;
		}
	}

	// Handle join request review
	async function handleReviewJoinRequest(requestId: string, action: 'accept' | 'deny') {
		if (!joinRequestsGroupId || reviewingRequest) return;

		reviewingRequest = requestId;
		try {
			await appState.reviewJoinRequest(requestId, joinRequestsGroupId, action);
		} catch (error) {
			console.error('Review join request error:', error);
		} finally {
			reviewingRequest = null;
		}
	}

	// Get join requests for a group
	function getJoinRequests(groupId: string): GroupJoinRequest[] {
		return appState.pendingJoinRequests.get(groupId) || [];
	}

	// Get total pending join requests count for all owned/admin groups
	const totalPendingJoinRequests = $derived(() => {
		let count = 0;
		for (const group of groups) {
			if (group.memberRole === 'owner' || group.memberRole === 'admin') {
				count += appState.getJoinRequestCount(group.id);
			}
		}
		return count;
	});

	// Toggle group expansion
	function toggleGroup(groupId: string) {
		try {
			if (expandedGroupId === groupId) {
				// Collapsing
				expandedGroupId = null;
				appState.setActiveGroupId(null);
			} else {
				// Expanding - fetch members if not already loaded
				expandedGroupId = groupId;
				appState.setActiveGroupId(groupId);

				const group = groups.find((g) => g.id === groupId);
				if (!group?.members || group.members.length === 0) {
					if (appState.fetchGroupMembers) {
						appState.fetchGroupMembers(groupId);
					}
				}
			}
		} catch (error) {
			console.error('Toggle group error:', error);
			appState.addToast('Failed to toggle group', 'error');
			// Reset to safe state
			expandedGroupId = null;
			appState.setActiveGroupId(null);
		}
	}

	// Validate delete confirmation
	let isDeleteValid = $derived(deleteConfirmation === 'DELETE');

	// Helper to detect uploaded images
	function isUploadedImage(avatar: string | null | undefined): boolean {
		return avatar?.startsWith('http') || avatar?.startsWith('/uploads') || false;
	}

	// Get friends not in group
	function getFriendsNotInGroup(groupId: string): Friend[] {
		const group = groups.find((g) => g.id === groupId);
		const members = group?.members || [];
		const memberIds = new Set(members.map((m: GroupMember) => m.userId));
		return friends.filter((f: Friend) => !memberIds.has(f.id) && f.status === 'accepted');
	}

	// Get filtered friends based on search
	function getFilteredFriends(groupId: string): Friend[] {
		const availableFriends = getFriendsNotInGroup(groupId);
		if (!friendSearchQuery.trim()) return availableFriends;

		const query = friendSearchQuery.toLowerCase();
		return availableFriends.filter((f: Friend) => {
			const displayName = f.friendDisplayName || f.friendUsername || '';
			return displayName.toLowerCase().includes(query);
		});
	}

	// Get pending invitations for a group
	function getPendingInvitationsForGroup(groupId: string): GroupInvitation[] {
		return invitations.filter(
			(inv: GroupInvitation) => inv.groupId === groupId && inv.status === 'pending'
		);
	}

	// State for tracking in-progress friend requests
	let sendingFriendRequest = $state<Set<string>>(new Set());

	// Friend requests from appState for checking pending requests
	const friendRequests = $derived(appState.friendRequests);

	/**
	 * Check if a friend request button should be shown for a group member
	 */
	function canSendFriendRequest(member: GroupMember): boolean {
		// Don't show for current user
		if (member.discordId === currentUserId) {
			return false;
		}

		// Check if already a friend
		const isFriend = friends.some((f: Friend) => f.friendDiscordId === member.discordId);
		if (isFriend) {
			return false;
		}

		// Check for pending incoming request
		const hasIncomingRequest = friendRequests.incoming.some(
			(r) => r.fromDiscordId === member.discordId
		);
		if (hasIncomingRequest) {
			return false;
		}

		// Check for pending outgoing request (fromDiscordId = target for outgoing)
		const hasOutgoingRequest = friendRequests.outgoing.some(
			(r) => r.fromDiscordId === member.discordId
		);
		if (hasOutgoingRequest) {
			return false;
		}

		return true;
	}

	async function handleSendFriendRequest(member: GroupMember) {
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

<PageLayout title="Groups" description="Manage your groups and invite friends">
	<div class="space-y-6">
		<!-- Pending Invitations -->
		{#if pendingInvitationsCount > 0}
			<div class="rounded-lg border border-discord/30 bg-discord/10 p-4" data-testid="pending-invitations">
				<h3 class="mb-3 text-sm font-semibold text-discord">
					Pending Invitations (<span data-testid="pending-invitations-count">{pendingInvitationsCount}</span>)
				</h3>
				<div class="space-y-2">
					{#each invitations.filter((inv: GroupInvitation) => inv.status === 'pending') as invitation (invitation.id)}
						<div class="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
							<div class="flex items-center gap-3">
								{#if invitation.group.avatar}
									{#if invitation.group.avatar.startsWith('http') || invitation.group.avatar.startsWith('/uploads')}
										<img
											src={invitation.group.avatar}
											alt={invitation.group.name}
											class="h-8 w-8 flex-shrink-0 rounded-full object-cover"
										/>
									{:else}
										<div class="text-2xl">{invitation.group.avatar}</div>
									{/if}
								{:else}
									<Users size={24} class="text-white/60" />
								{/if}
								<div>
									<p class="text-sm font-medium text-white">{invitation.group.name}</p>
									<p class="text-xs text-white/60">
										Invited by {invitation.inviterDisplayName || invitation.inviterUsername}
									</p>
								</div>
							</div>
							<div class="flex gap-2">
								<button
									type="button"
									onclick={() => handleAcceptInvitation(invitation.id)}
									data-testid="accept-invite-btn"
									class="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20"
								>
									Accept
								</button>
								<button
									type="button"
									onclick={() => handleDenyInvitation(invitation.id)}
									data-testid="decline-invite-btn"
									class="rounded-md bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
								>
									Decline
								</button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Groups List -->
		<div class="rounded-lg border border-white/10 bg-secondary p-6" data-testid="groups-list">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-white">Your Groups (<span data-testid="groups-count">{groups.length}</span>)</h2>
				<button
					type="button"
					onclick={openCreateDialog}
					data-testid="create-group-btn"
					class="inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
				>
					<Plus size={20} />
					<span>Create Group</span>
				</button>
			</div>

			{#if groups.length === 0}
				<div class="py-8 text-center">
					<Users size={48} class="mx-auto mb-3 text-white/20" />
					<p class="mb-4 text-white/40">No groups yet</p>
					<button
						type="button"
						onclick={openCreateDialog}
						class="inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
					>
						<Plus size={20} />
						<span>Create Your First Group</span>
					</button>
				</div>
			{:else}
				<div class="space-y-3">
					{#each sortedGroups as group (group.id)}
						{@const members = getSortedMembers(group.id)}
						<div class="overflow-hidden rounded-lg border border-white/10" data-testid="group-card" data-group-id={group.id}>
							<!-- Group Header -->
							<div
								class="flex items-center gap-3 bg-secondary/50 p-4 transition-colors hover:bg-secondary"
							>
								<button
									type="button"
									onclick={() => toggleGroup(group.id)}
									class="flex flex-1 items-center gap-3 text-left"
								>
									{#if group.avatar}
										{#if group.avatar.startsWith('http') || group.avatar.startsWith('/uploads')}
											<img
												src={group.avatar}
												alt={group.name}
												class="h-10 w-10 flex-shrink-0 rounded-full object-cover"
											/>
										{:else}
											<div class="flex-shrink-0 text-3xl">{group.avatar}</div>
										{/if}
									{:else}
										<Users size={32} class="flex-shrink-0 text-white/40" />
									{/if}

									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<h3 class="truncate text-sm font-semibold text-white">{group.name}</h3>
											{#if group.memberRole === 'owner'}
												<span class="rounded bg-[#ff9800]/20 px-2 py-0.5 text-xs text-[#ff9800]">
													Owner
												</span>
											{:else if group.memberRole === 'admin'}
												<span class="rounded bg-discord/20 px-2 py-0.5 text-xs text-discord">
													Admin
												</span>
											{/if}
										</div>
										<div class="mt-1 flex items-center gap-2">
											{#if group.tags && group.tags.length > 0}
												<div class="flex gap-1">
													{#each group.tags as tag, tagIndex (`${group.id}-tag-${tagIndex}`)}
														<span class="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60">
															{tag}
														</span>
													{/each}
												</div>
											{/if}
											<span class="text-xs text-white/40">
												{group.memberCount}
												{group.memberCount === 1 ? 'member' : 'members'}
											</span>
										</div>
									</div>
								</button>

								<!-- Actions -->
								<div class="flex items-center gap-2">
									{#if group.memberRole === 'owner' || group.memberRole === 'admin'}
										<!-- Pending Join Requests Button (only for discoverable groups with request method) -->
										{@const joinRequestCount = appState.getJoinRequestCount(group.id)}
										{#if (group as any).visibility === 'discoverable' && (group as any).joinMethod === 'request'}
											<button
												type="button"
												onclick={() => openJoinRequestsDialog(group.id)}
												data-testid="join-requests-btn"
												class="relative rounded-md p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
												title="View join requests"
											>
												<Clock size={20} />
												{#if joinRequestCount > 0}
													<span class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-discord px-1 text-xs font-medium text-white">
														{joinRequestCount}
													</span>
												{/if}
											</button>
										{/if}
										<button
											type="button"
											onclick={() => openInviteDialog(group.id)}
											data-testid="group-invite-btn"
											class="rounded-md p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
											title="Invite friends"
										>
											<UserPlus size={20} />
										</button>
									{/if}
									{#if group.memberRole === 'owner'}
										<button
											type="button"
											onclick={() => openEditDialog(group)}
											class="rounded-md p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
											title="Edit group"
										>
											<Settings size={20} />
										</button>
										<button
											type="button"
											onclick={() => openDeleteDialog(group.id)}
											class="rounded-md p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
											title="Delete group"
										>
											<Trash2 size={20} />
										</button>
									{:else}
										<button
											type="button"
											onclick={() => handleLeaveGroup(group.id)}
											class="rounded-md p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
											title="Leave group"
										>
											<LogOut size={20} />
										</button>
									{/if}
								</div>
							</div>

							<!-- Group Members (Expanded) -->
							{#if expandedGroupId === group.id}
								{@const members = getSortedMembers(group.id)}
								<div class="border-t border-white/10 bg-panel-dark/50">
									<div class="p-4">
										<h4 class="mb-3 text-xs font-semibold text-white/60 uppercase">Members</h4>
										{#if loadingMembers.has(group.id)}
											<!-- Loading skeleton for members -->
											<div class="space-y-2">
												<Skeleton count={Math.min(Math.max(group.memberCount, 1), 10)} />
											</div>
										{:else}
											<div class="space-y-2">
												{#each members as member (member.userId)}
													<div
														class="flex items-center justify-between rounded-lg bg-secondary/50 p-2 transition-colors hover:bg-secondary"
													>
														<div class="flex items-center gap-3">
															<Avatar
																avatar={member.avatar}
																discordId={member.discordId}
																userId={member.userId}
																alt={member.username}
																size={8}
																showOnline={false}
															/>
															<div class="flex-1">
																<p class="text-sm font-medium text-white">
																	{member.displayName || 'Unknown player'}
																</p>
																<p class="text-xs text-white/40">
																	{member.role}
																	{#if member.isOnline}
																		<span class="text-success">• Online</span>
																	{/if}
																</p>
															</div>
														</div>
														<div class="flex items-center gap-1">
															{#if canSendFriendRequest(member)}
																<button
																	type="button"
																	onclick={() => handleSendFriendRequest(member)}
																	disabled={sendingFriendRequest.has(member.discordId)}
																	class="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
																	title="Send friend request"
																>
																	{#if sendingFriendRequest.has(member.discordId)}
																		<Loader2 size={16} class="animate-spin" />
																	{:else}
																		<UserPlus size={16} />
																	{/if}
																</button>
															{/if}
														{#if member.userId !== currentUserId && group.memberRole === 'owner' && member.role !== 'owner'}
																{#if member.role === 'member'}
																	<button
																		type="button"
																		onclick={() => handlePromoteMember(group.id, member.userId)}
																		class="rounded-md px-2 py-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white flex items-center gap-1"
																		title="Promote to admin"
																	>
																		<Star size={16} />
																		<span class="text-xs">Promote</span>
																	</button>
																{:else if member.role === 'admin'}
																	<button
																		type="button"
																		onclick={() => handleDemoteMember(group.id, member.userId)}
																		class="rounded-md px-2 py-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white flex items-center gap-1"
																		title="Demote to member"
																	>
																		<StarOff size={16} />
																		<span class="text-xs">Demote</span>
																	</button>
																{/if}
																<button
																	type="button"
																	onclick={() => handleRemoveMember(group.id, member.userId)}
																	class="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
																	title="Remove member"
																>
																	<X size={16} />
																</button>
														{:else if member.userId !== currentUserId && member.canRemoveMembers && member.role !== 'owner'}
															<button
																type="button"
																onclick={() => handleRemoveMember(group.id, member.userId)}
																class="rounded-md p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
																title="Remove member"
															>
																<X size={16} />
															</button>
														{/if}
														</div>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</PageLayout>

<!-- Create Group Dialog -->
<Dialog
	bind:open={showCreateDialog}
	title="Create Group"
	description="Create a new group to organize and share logs with friends"
	confirmLabel="Create Group"
	loading={creating}
	onConfirm={handleCreateGroup}
>
	<div class="space-y-4">
		<div>
			<label for="group-name" class="mb-2 block text-sm font-medium text-white/80">
				Group Name <span class="text-red-400">*</span>
			</label>
			<input
				id="group-name"
				name="name"
				type="text"
				bind:value={groupName}
				placeholder="My Awesome Group"
				maxlength="100"
				class="w-full rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
			/>
		</div>

		<div>
			<label for="group-description" class="mb-2 block text-sm font-medium text-white/80">
				Description
			</label>
			<textarea
				id="group-description"
				name="description"
				bind:value={groupDescription}
				placeholder="What's this group about?"
				rows="3"
				maxlength="500"
				class="w-full resize-none rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
			></textarea>
		</div>

		<div class="mb-4">
			<div class="mb-3 block text-sm font-medium text-white/80">Avatar</div>

			<!-- Upload Button (ImageUpload shows preview above button if image exists) -->
			<ImageUpload
				buttonClass="rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
				currentImage={isUploadedImage(groupAvatar) ? groupAvatar : ''}
				onUploadSuccess={(url) => {
					groupAvatar = url;
					appState.addToast('Image uploaded successfully', 'success');
				}}
				onUploadError={(error) => {
					appState.addToast(error, 'error');
				}}
				token={appState.token ?? ''}
				serverUrl={appState.uploadUrl}
				fetchFn={appState.uploadFetchFn}
			>
				{groupAvatar ? 'Change' : 'Upload'}
			</ImageUpload>

			<!-- Clear Button (centered below upload) -->
			{#if groupAvatar}
				<div class="flex justify-center">
					<button
						type="button"
						onclick={() => {
							groupAvatar = '';
							appState.addToast('Avatar cleared', 'success');
						}}
						class="rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
					>
						Clear
					</button>
				</div>
			{/if}

			<!-- Emoji Input (alternative option) -->
			{#if !isUploadedImage(groupAvatar)}
				<input
					id="group-avatar"
					name="avatar"
					type="text"
					bind:value={groupAvatar}
					oninput={(e) => {
						const input = e.currentTarget.value;
						// Block URL inputs
						if (input.match(/^https?:\/\/|^\/uploads/)) {
							e.currentTarget.value = '';
							groupAvatar = '';
							appState.addToast('Please use the Upload Avatar button for images', 'error');
						}
					}}
					placeholder="Or paste emoji: 🚀"
					class="mt-2 w-full rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
				/>
			{/if}
		</div>

		<div>
			<label for="group-tags" class="mb-2 block text-sm font-medium text-white/80">
				Tags (comma-separated)
			</label>
			<input
				id="group-tags"
				name="tags"
				type="text"
				bind:value={groupTags}
				placeholder="pve, trading, exploration"
				class="w-full rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
			/>
		</div>

		<!-- Visibility Settings -->
		<div class="border-t border-white/10 pt-4">
			<div class="mb-3 block text-sm font-medium text-white/80">Visibility</div>
			<div class="space-y-2">
				<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-panel-dark p-3 transition-colors hover:bg-white/5 {groupVisibility === 'private' ? 'border-discord' : ''}">
					<input
						type="radio"
						name="visibility"
						value="private"
						bind:group={groupVisibility}
						class="mt-0.5"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<Lock size={16} class="text-white/60" />
							<span class="text-sm font-medium text-white">Private</span>
						</div>
						<p class="mt-0.5 text-xs text-white/50">Only invited members can join</p>
					</div>
				</label>
				<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-panel-dark p-3 transition-colors hover:bg-white/5 {groupVisibility === 'discoverable' ? 'border-discord' : ''}">
					<input
						type="radio"
						name="visibility"
						value="discoverable"
						bind:group={groupVisibility}
						class="mt-0.5"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<Globe size={16} class="text-white/60" />
							<span class="text-sm font-medium text-white">Discoverable</span>
						</div>
						<p class="mt-0.5 text-xs text-white/50">Visible in Discover and searchable by others</p>
					</div>
				</label>
			</div>
		</div>

		<!-- Join Method (only shown when discoverable) -->
		{#if groupVisibility === 'discoverable'}
			<div>
				<div class="mb-3 block text-sm font-medium text-white/80">How can people join?</div>
				<div class="space-y-2">
					<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-panel-dark p-3 transition-colors hover:bg-white/5 {groupJoinMethod === 'open' ? 'border-discord' : ''}">
						<input
							type="radio"
							name="joinMethod"
							value="open"
							bind:group={groupJoinMethod}
							class="mt-0.5"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium text-white">Open</span>
							<p class="mt-0.5 text-xs text-white/50">Anyone can join instantly</p>
						</div>
					</label>
					<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-panel-dark p-3 transition-colors hover:bg-white/5 {groupJoinMethod === 'request' ? 'border-discord' : ''}">
						<input
							type="radio"
							name="joinMethod"
							value="request"
							bind:group={groupJoinMethod}
							class="mt-0.5"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium text-white">Request to Join</span>
							<p class="mt-0.5 text-xs text-white/50">Admins must approve join requests</p>
						</div>
					</label>
				</div>
			</div>
		{/if}
	</div>
</Dialog>

<!-- Edit Group Dialog -->
<Dialog
	bind:open={showEditDialog}
	title="Edit Group"
	description="Update group information"
	confirmLabel="Save Changes"
	loading={updating}
	onConfirm={handleUpdateGroup}
>
	<div class="space-y-4">
		<div>
			<label for="edit-group-name" class="mb-2 block text-sm font-medium text-white/80">
				Group Name <span class="text-red-400">*</span>
			</label>
			<input
				id="edit-group-name"
				type="text"
				bind:value={groupName}
				placeholder="My Awesome Group"
				maxlength="100"
				class="w-full rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
			/>
		</div>

		<div>
			<label for="edit-group-description" class="mb-2 block text-sm font-medium text-white/80">
				Description
			</label>
			<textarea
				id="edit-group-description"
				bind:value={groupDescription}
				placeholder="What's this group about?"
				rows="3"
				maxlength="500"
				class="w-full resize-none rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
			></textarea>
		</div>

		<div class="mb-4">
			<div class="mb-3 block text-sm font-medium text-white/80">Avatar</div>

			<!-- Upload Button (ImageUpload shows preview above button if image exists) -->
			<ImageUpload
				buttonClass="rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
				currentImage={isUploadedImage(groupAvatar) ? groupAvatar : ''}
				onUploadSuccess={(url) => {
					groupAvatar = url;
					appState.addToast('Image uploaded successfully', 'success');
				}}
				onUploadError={(error) => {
					appState.addToast(error, 'error');
				}}
				token={appState.token ?? ''}
				serverUrl={appState.uploadUrl}
				fetchFn={appState.uploadFetchFn}
			>
				{groupAvatar ? 'Change' : 'Upload'}
			</ImageUpload>

			<!-- Clear Button (centered below upload) -->
			{#if groupAvatar}
				<div class="flex justify-center">
					<button
						type="button"
						onclick={() => {
							groupAvatar = '';
							appState.addToast('Avatar cleared', 'success');
						}}
						class="rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white"
					>
						Clear
					</button>
				</div>
			{/if}

			<!-- Emoji Input (alternative option) -->
			{#if !isUploadedImage(groupAvatar)}
				<input
					id="edit-group-avatar"
					type="text"
					bind:value={groupAvatar}
					oninput={(e) => {
						const input = e.currentTarget.value;
						// Block URL inputs
						if (input.match(/^https?:\/\/|^\/uploads/)) {
							e.currentTarget.value = '';
							groupAvatar = '';
							appState.addToast('Please use the Upload Avatar button for images', 'error');
						}
					}}
					placeholder="Or paste emoji: 🚀"
					class="mt-2 w-full rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
				/>
			{/if}
		</div>

		<div>
			<label for="edit-group-tags" class="mb-2 block text-sm font-medium text-white/80">
				Tags (comma-separated)
			</label>
			<input
				id="edit-group-tags"
				type="text"
				bind:value={groupTags}
				placeholder="pve, trading, exploration"
				class="w-full rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
			/>
		</div>

		<!-- Visibility Settings -->
		<div class="border-t border-white/10 pt-4">
			<div class="mb-3 block text-sm font-medium text-white/80">Visibility</div>
			<div class="space-y-2">
				<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-panel-dark p-3 transition-colors hover:bg-white/5 {groupVisibility === 'private' ? 'border-discord' : ''}">
					<input
						type="radio"
						name="edit-visibility"
						value="private"
						bind:group={groupVisibility}
						class="mt-0.5"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<Lock size={16} class="text-white/60" />
							<span class="text-sm font-medium text-white">Private</span>
						</div>
						<p class="mt-0.5 text-xs text-white/50">Only invited members can join</p>
					</div>
				</label>
				<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-panel-dark p-3 transition-colors hover:bg-white/5 {groupVisibility === 'discoverable' ? 'border-discord' : ''}">
					<input
						type="radio"
						name="edit-visibility"
						value="discoverable"
						bind:group={groupVisibility}
						class="mt-0.5"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<Globe size={16} class="text-white/60" />
							<span class="text-sm font-medium text-white">Discoverable</span>
						</div>
						<p class="mt-0.5 text-xs text-white/50">Visible in Discover and searchable by others</p>
					</div>
				</label>
			</div>
		</div>

		<!-- Join Method (only shown when discoverable) -->
		{#if groupVisibility === 'discoverable'}
			<div>
				<div class="mb-3 block text-sm font-medium text-white/80">How can people join?</div>
				<div class="space-y-2">
					<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-panel-dark p-3 transition-colors hover:bg-white/5 {groupJoinMethod === 'open' ? 'border-discord' : ''}">
						<input
							type="radio"
							name="edit-joinMethod"
							value="open"
							bind:group={groupJoinMethod}
							class="mt-0.5"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium text-white">Open</span>
							<p class="mt-0.5 text-xs text-white/50">Anyone can join instantly</p>
						</div>
					</label>
					<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-panel-dark p-3 transition-colors hover:bg-white/5 {groupJoinMethod === 'request' ? 'border-discord' : ''}">
						<input
							type="radio"
							name="edit-joinMethod"
							value="request"
							bind:group={groupJoinMethod}
							class="mt-0.5"
						/>
						<div class="flex-1">
							<span class="text-sm font-medium text-white">Request to Join</span>
							<p class="mt-0.5 text-xs text-white/50">Admins must approve join requests</p>
						</div>
					</label>
				</div>
			</div>
		{/if}
	</div>
</Dialog>

<!-- Invite Friends Dialog -->
{#if selectedGroupId && selectedGroup}
	{@const filteredFriends = getFilteredFriends(selectedGroupId)}
	{@const pendingGroupInvites = getPendingInvitationsForGroup(selectedGroupId)}
	<Dialog
		bind:open={showInviteDialog}
		title="Invite Friends"
		description={`Invite friends to ${selectedGroup.name}`}
		confirmLabel={`Send ${selectedFriendIds.size > 0 ? selectedFriendIds.size : ''} Invitation${selectedFriendIds.size !== 1 ? 's' : ''}`}
		loading={inviting}
		disableConfirm={selectedFriendIds.size === 0}
		onConfirm={handleInviteFriends}
	>
		<div class="space-y-4">
			<!-- Pending Invitations -->
			{#if pendingGroupInvites.length > 0}
				<div class="rounded-lg border border-discord/30 bg-discord/10 p-3">
					<h4 class="mb-2 text-xs font-semibold text-discord uppercase">
						Pending Invitations ({pendingGroupInvites.length})
					</h4>
					<div class="space-y-1">
						{#each pendingGroupInvites as invite (invite.id)}
							<div class="flex items-center gap-2 text-xs text-white/60">
								<span>Invitation sent</span>
								<span class="text-white/40">- Pending</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Search Input -->
			<div class="relative">
				<Search size={16} class="absolute top-1/2 left-3 -translate-y-1/2 text-white/40" />
				<input
					type="text"
					bind:value={friendSearchQuery}
					placeholder="Search friends..."
					class="w-full rounded-md border border-white/10 bg-panel-dark py-2 pr-3 pl-9 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
				/>
			</div>

			<!-- Friends List -->
			{#if filteredFriends.length === 0 && friendSearchQuery}
				<div class="py-8 text-center">
					<p class="text-white/40">No friends found matching "{friendSearchQuery}"</p>
				</div>
			{:else if filteredFriends.length === 0}
				<div class="py-8 text-center">
					<p class="text-white/40">No friends available to invite</p>
				</div>
			{:else}
				<div class="max-h-80 space-y-1 overflow-y-auto pr-1">
					{#each filteredFriends as friend (friend.id)}
						{@const isSelected = selectedFriendIds.has(friend.friendDiscordId)}
						<button
							type="button"
							onclick={() => toggleFriendSelection(friend.friendDiscordId)}
							class="flex w-full items-center gap-3 rounded-lg bg-secondary/50 p-2.5 transition-colors hover:bg-secondary {isSelected
								? 'ring-2 ring-discord ring-inset'
								: ''}"
						>
							<!-- Checkbox -->
							<div
								class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors {isSelected
									? 'border-discord bg-discord'
									: 'border-white/20'}"
							>
								{#if isSelected}
									<Check size={14} class="text-white" />
								{/if}
							</div>

							<!-- Avatar -->
							<Avatar
								avatar={friend.friendAvatar}
								discordId={friend.friendDiscordId}
								userId={friend.friendUserId}
								alt={friend.friendDisplayName || friend.friendUsername}
								size={8}
								showOnline={true}
								isOnline={friend.isOnline}
							/>

							<!-- Friend Info -->
							<div class="flex-1 text-left">
								<p class="text-sm font-medium text-white">
									{friend.friendDisplayName || friend.friendUsername}
								</p>
								{#if friend.isOnline}
									<p class="text-xs text-success">Online</p>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</Dialog>
{/if}

<!-- Delete Group Dialog -->
<Dialog
	bind:open={showDeleteDialog}
	title="Delete Group"
	description="This action cannot be undone and will permanently delete this group and all its data."
	variant="danger"
	confirmLabel="Delete Group"
	loading={deleting}
	disableConfirm={!isDeleteValid}
	onConfirm={handleDeleteGroup}
	onCancel={() => (deleteConfirmation = '')}
>
	<div class="space-y-4">
		<ul class="list-inside list-disc space-y-2 text-sm text-white/70">
			<li>Group information and settings</li>
			<li>All member data</li>
			<li>Shared logs and history</li>
		</ul>

		<div>
			<label for="delete-group-confirmation" class="mb-2 block text-sm font-medium text-white/80">
				Type <strong class="text-red-400">DELETE</strong> to confirm:
			</label>
			<input
				id="delete-group-confirmation"
				type="text"
				bind:value={deleteConfirmation}
				placeholder="DELETE"
				class="w-full rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-danger focus:ring-2 focus:ring-danger focus:outline-none"
			/>
		</div>
	</div>
</Dialog>

<!-- Join Requests Dialog -->
{#if showJoinRequestsDialog && joinRequestsGroupId}
	{@const joinRequestsGroup = groups.find(g => g.id === joinRequestsGroupId)}
	{@const requests = getJoinRequests(joinRequestsGroupId)}
	<Dialog
		bind:open={showJoinRequestsDialog}
		title="Join Requests"
		description={joinRequestsGroup ? `Review join requests for ${joinRequestsGroup.name}` : 'Review join requests'}
		showFooter={false}
	>
		<div class="space-y-3">
			{#if loadingJoinRequests}
				<div class="flex items-center justify-center py-8">
					<Loader2 size={24} class="animate-spin text-white/60" />
				</div>
			{:else if requests.length === 0}
				<div class="py-8 text-center">
					<Clock size={32} class="mx-auto mb-2 text-white/20" />
					<p class="text-sm text-white/40">No pending join requests</p>
				</div>
			{:else}
				{#each requests as request (request.id)}
					<div class="rounded-lg border border-white/10 bg-secondary/50 p-4">
						<div class="flex items-start gap-3">
							<Avatar
								avatar={request.avatar}
								discordId={request.userId}
								userId={request.userId}
								alt={request.username}
								size={10}
								showOnline={false}
							/>
							<div class="min-w-0 flex-1">
								<p class="font-medium text-white">{request.displayName || request.username}</p>
								<p class="text-xs text-white/50">
									Requested {new Date(request.createdAt).toLocaleDateString()}
								</p>
								{#if request.message}
									<p class="mt-2 rounded bg-white/5 p-2 text-sm text-white/70 italic">
										"{request.message}"
									</p>
								{/if}
							</div>
						</div>
						<div class="mt-3 flex justify-end gap-2">
							<button
								type="button"
								onclick={() => handleReviewJoinRequest(request.id, 'deny')}
								disabled={reviewingRequest === request.id}
								class="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
							>
								{#if reviewingRequest === request.id}
									<Loader2 size={12} class="inline animate-spin" />
								{:else}
									Deny
								{/if}
							</button>
							<button
								type="button"
								onclick={() => handleReviewJoinRequest(request.id, 'accept')}
								disabled={reviewingRequest === request.id}
								class="rounded-md bg-discord px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-discord/80 disabled:opacity-50"
							>
								{#if reviewingRequest === request.id}
									<Loader2 size={12} class="inline animate-spin" />
								{:else}
									Accept
								{/if}
							</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</Dialog>
{/if}
