<script lang="ts">
	import { SvelteSet, SvelteDate } from 'svelte/reactivity';
	import { formatDistanceToNow } from 'date-fns';
	import { Trash2, Copy, Check, X } from '@lucide/svelte';
	import { appState } from '../app.svelte.js';
	import Avatar from './Avatar.svelte';
	import PageLayout from './PageLayout.svelte';
	import Dialog from './Dialog.svelte';
	import Skeleton from './Skeleton.svelte';
	import AddFriendWidget from './AddFriendWidget.svelte';
	import type { NotificationType } from '../types/notifications.js';
	import type { Friend, FriendRequest } from '@pico/types';

	// ============================================================================
	// Data from appState
	// ============================================================================

	// Data from appState
	const friends = $derived(appState.friends);
	const incomingRequests = $derived(appState.friendRequests.incoming);
	const outgoingRequests = $derived(appState.friendRequests.outgoing);
	const userFriendCode = $derived(appState.user?.friendCode ?? null);

	// Notification handler
	function notify(message: string, type: NotificationType) {
		appState.addToast(message, type);
	}

	// ============================================================================
	// Props & State
	// ============================================================================

	// Reactive date for time display - updates every minute
	const now = new SvelteDate();
	$effect(() => {
		const interval = setInterval(() => {
			now.setTime(Date.now());
		}, 60000);
		return () => clearInterval(interval);
	});

	const discordCdnUrl = 'https://cdn.discordapp.com';
	const processingRequests = new SvelteSet();
	const isLoading = $state(false); // Local loading state

	let friendToRemove = $state<{ id: string; displayName: string } | null>(null);
	let showRemoveDialog = $state(false);
	let isRemoving = $state(false);
	let copySuccess = $state(false);

	// ============================================================================
	// Derived State
	// ============================================================================

	let acceptedFriends = $derived.by(() => {
		if (friends.length > 0) {
		}
		const accepted = friends.filter((f: Friend) => f.status === 'accepted');
		if (accepted.length > 0) {
		}
		return accepted;
	});

	// ============================================================================
	// Helper Functions
	// ============================================================================

	function getDisplayName(friend: Friend | FriendRequest): string {
		// Use type guard to distinguish between Friend and FriendRequest
		// Friend objects have friendUsername, FriendRequest objects have fromUsername
		if ('friendUsername' in friend && typeof friend.friendUsername === 'string') {
			return friend.friendDisplayName || friend.friendUsername || 'Unknown';
		}
		if ('fromUsername' in friend && typeof friend.fromUsername === 'string') {
			return friend.fromDisplayName || friend.fromUsername || 'Unknown';
		}
		return 'Unknown';
	}

	function formatRelativeTime(dateString: string): string {
		return formatDistanceToNow(new Date(dateString), { addSuffix: true });
	}

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

	// ============================================================================
	// Event Handlers
	// ============================================================================

	async function handleAcceptRequest(friendshipId: string) {
		try {
			await appState.acceptFriendRequest(friendshipId);
		} catch (error) {
			console.error('[FriendsPage] Error accepting friend request:', error);
		}
	}

	async function handleDenyRequest(friendshipId: string) {
		try {
			await appState.denyFriendRequest(friendshipId);
		} catch (error) {
			console.error('[FriendsPage] Error denying friend request:', error);
		}
	}

	async function handleCancelRequest(friendshipId: string) {
		try {
			await appState.cancelFriendRequest(friendshipId);
		} catch (error) {
			console.error('[FriendsPage] Error cancelling friend request:', error);
		}
	}

	async function handleRemoveFriend(friendId: string, displayName: string) {
		friendToRemove = { id: friendId, displayName };
		showRemoveDialog = true;
	}

	async function confirmRemove() {
		if (!friendToRemove) return;

		try {
			await appState.removeFriendship(friendToRemove.id);
		} catch (error) {
			console.error('[FriendsPage] Error removing friend:', error);
		}
	}

	function handleDialogCancel() {
		friendToRemove = null;
	}

	async function handleSendRequest(friendCode: string) {
		try {
			await appState.sendFriendRequest(friendCode);
		} catch (error) {
			console.error('[FriendsPage] Error sending friend request:', error);
			throw error; // Re-throw so AddFriendWidget can handle it
		}
	}

	async function copyFriendCode() {
		if (!userFriendCode) return;

		try {
			await navigator.clipboard.writeText(userFriendCode);
			copySuccess = true;
			notify('Friend code copied to clipboard', 'success');

			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch {
			// Intentionally empty - clipboard errors are handled by notify
			notify('Failed to copy friend code', 'error');
		}
	}

</script>

<!-- ============================================================================ -->
<!-- Main Layout -->
<!-- ============================================================================ -->

<PageLayout title="Friends" description="Manage your friends and friend requests">
	{#if isLoading}
		<div class="space-y-6">
			<Skeleton count={5} />
		</div>
	{:else}
		<div class="flex flex-col gap-6">
			<!-- ================================================================ -->
			<!-- Main Content -->
			<!-- ================================================================ -->
			<div class="space-y-6">
				<!-- Pending Requests Section -->
				{#if incomingRequests.length > 0 || outgoingRequests.length > 0}
					<div class="rounded-lg border border-white/5 bg-[rgb(15,35,47)] p-6" data-testid="pending-requests-section">
						<h2 class="mb-4 text-xl font-semibold text-white">
							Pending Requests (<span data-testid="pending-requests-count">{incomingRequests.length + outgoingRequests.length}</span>)
						</h2>

						<!-- Incoming Requests -->
						{#if incomingRequests.length > 0}
							<div class="flex flex-col gap-4">
								{#each incomingRequests as request (request.id)}
									<div class="flex items-center gap-4 rounded-lg bg-white/5 p-4" data-testid="incoming-request" data-request-id={request.id}>
										<Avatar
											avatar={request.fromAvatar}
											discordId={request.fromDiscordId}
											userId={request.fromUserId}
											alt={getDisplayName(request)}
											size={10}
											{discordCdnUrl}
										/>

										<div class="min-w-0 flex-1">
											<h3 class="truncate text-sm font-semibold text-white">
												{getDisplayName(request)}
											</h3>
											{#if request.fromPlayer}
												<p class="truncate text-sm text-white/60">
													{request.fromPlayer}
												</p>
											{/if}
											<p class="text-xs text-white/40">
												Received {formatRelativeTime(request.createdAt)}
											</p>
										</div>

										<div class="flex gap-2">
											<button
												onclick={() => handleAcceptRequest(request.id)}
												disabled={processingRequests.has(request.id)}
												title="Accept"
												data-testid="accept-request-btn"
												class="inline-flex items-center justify-center rounded-md bg-white/10 p-3 font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
											>
												<Check size={20} />
											</button>
											<button
												onclick={() => handleDenyRequest(request.id)}
												disabled={processingRequests.has(request.id)}
												title="Deny"
												data-testid="decline-request-btn"
												class="inline-flex items-center justify-center rounded-md bg-white/5 p-3 font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
											>
												<X size={20} />
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Outgoing Requests -->
						{#if outgoingRequests.length > 0}
							<div class="mt-6">
								<h3 class="mb-3 text-lg font-medium text-white">
									Sent Requests ({outgoingRequests.length})
								</h3>
								<div class="flex flex-col gap-4">
									{#each outgoingRequests as request (request.id)}
										<div class="flex items-center gap-4 rounded-lg bg-white/5 p-4">
											<Avatar
												avatar={request.fromAvatar}
												discordId={request.fromDiscordId}
												userId={request.fromUserId}
												alt={getDisplayName(request)}
												size={10}
												{discordCdnUrl}
											/>

											<div class="min-w-0 flex-1">
												<h3 class="truncate text-sm font-semibold text-white">
													{getDisplayName(request)}
												</h3>
												{#if request.fromPlayer}
													<p class="truncate text-sm text-white/60">
														{request.fromPlayer}
													</p>
												{/if}
												<p class="text-xs text-white/40">
													Sent {formatRelativeTime(request.createdAt)}
												</p>
											</div>

											<button
												onclick={() => handleCancelRequest(request.id)}
												disabled={processingRequests.has(request.id)}
												title="Cancel request"
												class="inline-flex items-center justify-center rounded-md bg-white/5 p-3 font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
											>
												<X size={20} />
											</button>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				<!-- ================================================================ -->
				<!-- Add Friend Section -->
				<!-- ================================================================ -->
				<div class="space-y-6">
					<div class="rounded-lg border border-white/5 bg-[rgb(15,35,47)] p-6">
						<h2 class="mb-4 text-xl font-semibold text-white">Add Friend</h2>

						<!-- Your Friend Code -->
						{#if userFriendCode}
							<div class="mb-4 flex items-center gap-4 rounded-lg bg-white/10 p-4">
								<div class="min-w-0 flex-1">
									<label
										for="user-friend-code"
										class="mb-1 block text-xs font-medium text-white/60"
									>
										Your Friend Code
									</label>
									<input
										id="user-friend-code"
										type="text"
										value={userFriendCode}
										readonly
										class="w-full border-0 bg-transparent px-0 py-0 font-mono text-sm text-white focus:outline-none"
									/>
								</div>
								<button
									type="button"
									onclick={copyFriendCode}
									title="Copy"
									class="inline-flex items-center justify-center rounded-md bg-white/10 p-3 font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
								>
									{#if copySuccess}
										<Check size={20} />
									{:else}
										<Copy size={20} />
									{/if}
								</button>
							</div>
						{/if}

						<!-- Send Friend Request Widget -->
						<div class="rounded-lg bg-white/5 p-4">
							<span class="mb-2 block text-xs font-medium text-white/60"> Friend's Code </span>
							<AddFriendWidget
								placeholder="ABCD1234"
								maxLength={8}
								onSendRequest={handleSendRequest}
							/>
						</div>
					</div>
				</div>

				<!-- Friends List -->
				<div class="rounded-lg border border-white/5 bg-[rgb(15,35,47)] p-6" data-testid="friends-list">
					<h2 class="mb-4 text-xl font-semibold text-white">
						Friends (<span data-testid="friends-count">{acceptedFriends.length}</span>)
					</h2>

					<div class="flex flex-col gap-4">
						{#if acceptedFriends.length === 0}
							<p class="text-white/40">No friends yet. Send a friend request to get started!</p>
						{:else}
							{#each acceptedFriends as friend (friend.id)}
								<div class="flex items-center gap-4 rounded-lg bg-white/5 p-4" data-testid="friend-card" data-friend-id={friend.id} data-friend-code={friend.friendCode}>
									<Avatar
										avatar={friend.friendAvatar}
										discordId={friend.friendDiscordId}
										userId={friend.friendUserId}
										alt={getDisplayName(friend)}
										size={10}
										{discordCdnUrl}
									/>

									<div class="min-w-0 flex-1">
										<h3 class="truncate text-sm font-semibold text-white">
											{getDisplayName(friend)}
										</h3>
										{#if friend.friendPlayer}
											<p class="truncate text-sm text-white/60">
												{friend.friendPlayer}
											</p>
										{/if}
										{#if friend.friendTimeZone}
											<span class="truncate text-xs text-white/40" title={friend.friendTimeZone}>
												{getLocalTime(friend.friendTimeZone)} · {getCityFromTimezone(friend.friendTimeZone)}
											</span>
										{/if}
										<p class="text-xs text-white/40">
											Friends {formatRelativeTime(friend.createdAt)}
										</p>
									</div>

									<button
										onclick={() => handleRemoveFriend(friend.id, getDisplayName(friend))}
										title="Remove"
										class="inline-flex items-center justify-center rounded-md bg-white/5 p-3 font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
									>
										<Trash2 size={20} />
									</button>
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
</PageLayout>

<!-- ============================================================================ -->
<!-- Remove Friend Dialog -->
<!-- ============================================================================ -->

<Dialog
	bind:open={showRemoveDialog}
	title="Remove Friend"
	description="This action cannot be undone."
	variant="danger"
	confirmLabel="Remove Friend"
	loading={isRemoving}
	onConfirm={confirmRemove}
	onCancel={handleDialogCancel}
>
	{#if friendToRemove}
		<p class="text-white/80">
			Are you sure you want to remove <span class="font-semibold text-white"
				>{friendToRemove.displayName}</span
			> from your friends list?
		</p>
	{/if}
</Dialog>
