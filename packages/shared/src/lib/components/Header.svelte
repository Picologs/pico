<script lang="ts">
	import { Copy, Check, X, Bell, LogOut, Settings, Users, FolderOpen, ScrollText, BrushCleaning, Download, Loader2 } from '@lucide/svelte';
	import Avatar from './Avatar.svelte';
	import DiscordIcon from './DiscordIcon.svelte';
	import Dialog from './Dialog.svelte';
	import { appState } from '../app.svelte.js';
	import type { FriendRequest, GroupInvitation, GroupJoinRequest } from '@pico/types';

	// Props
	interface Props {
		onClearLogs?: () => void;
	}

	let { onClearLogs }: Props = $props();

	// Internal state
	let copiedStatusVisible = $state(false);
	let showClearDialog = $state(false);

	// Derived state from appState
	const user = $derived(appState.user);
	const friendCode = $derived(appState.user?.friendCode);
	const connectionStatus = $derived(appState.connectionStatus);
	const groupInvitations = $derived(
		appState.groupInvitations as unknown as GroupInvitation[]
	);
	const pendingJoinRequests = $derived(
		appState.allPendingJoinRequests as unknown as GroupJoinRequest[]
	);

	// Calculate notification count (friend requests, group invitations, and join requests)
	// Using $derived correctly - for the COMPUTATION, not just property access
	const notificationCount = $derived(
		appState.friendRequests.incoming.length + groupInvitations.length + pendingJoinRequests.length
	);

	// Format relative time
	function formatRelativeTime(timestamp: string): string {
		const now = Date.now();
		const then = new Date(timestamp).getTime();
		const diffMs = now - then;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 30) return `${diffDays}d ago`;
		return new Date(timestamp).toLocaleDateString();
	}

	// Handle copy friend code
	async function handleCopyFriendCode() {
		if (!friendCode) return;

		try {
			await navigator.clipboard.writeText(friendCode);
			copiedStatusVisible = true;
			appState.addToast('Friend code copied to clipboard', 'success');

			setTimeout(() => {
				copiedStatusVisible = false;
			}, 1500);
		} catch {
			appState.addToast('Failed to copy friend code', 'error');
		}
	}

	// Handle sign out
	function handleSignOut() {
		appState.signOut?.();
	}

	// Handle navigation
	function navigate(path: string) {
		appState.navigate?.(path);
	}

	// Friend request handlers
	async function handleAcceptFriend(requestId: string) {
		try {
			await appState.acceptFriendRequest(requestId);
		} catch (error) {
			console.error('[Header] Failed to accept friend request:', error);
		}
	}

	async function handleDenyFriend(requestId: string) {
		try {
			await appState.denyFriendRequest(requestId);
		} catch (error) {
			console.error('[Header] Failed to deny friend request:', error);
		}
	}

	// Group invitation handlers
	async function handleAcceptInvitation(invitationId: string) {
		try {
			await appState.acceptGroupInvitation(invitationId);
		} catch (error) {
			console.error('[Header] Failed to accept group invitation:', error);
		}
	}

	async function handleDenyInvitation(invitationId: string) {
		try {
			await appState.denyGroupInvitation(invitationId);
		} catch (error) {
			console.error('[Header] Failed to deny group invitation:', error);
		}
	}

	// Join request handlers
	async function handleAcceptJoinRequest(requestId: string, groupId: string) {
		try {
			await appState.reviewJoinRequest(requestId, groupId, 'accept');
		} catch (error) {
			console.error('[Header] Failed to accept join request:', error);
		}
	}

	async function handleDenyJoinRequest(requestId: string, groupId: string) {
		try {
			await appState.reviewJoinRequest(requestId, groupId, 'deny');
		} catch (error) {
			console.error('[Header] Failed to deny join request:', error);
		}
	}

	// Clear logs handler - opens confirmation dialog
	function handleClearLogs() {
		const logCount = appState.logs.length;
		if (logCount === 0) {
			appState.addToast('No logs to clear', 'info');
			return;
		}
		showClearDialog = true;
	}

	// Actually clear the logs after user confirms
	async function confirmClearLogs() {
		appState.clearLogs();
		onClearLogs?.();
		appState.addToast('Logs cleared', 'success');
	}

	// Derived values for dialog
	const logCount = $derived(appState.logs.length);
	const clearDialogDescription = $derived(
		`This will remove all ${logCount} log${logCount === 1 ? '' : 's'} from view but continue monitoring your selected log file${connectionStatus === 'connected' ? ' and receiving logs from friends/groups' : ''}.`
	);

</script>

<header
	class="flex h-[56px] items-center justify-between border-b border-white/5 bg-secondary px-3 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
>
	<div class="flex flex-shrink-0 items-center gap-2">
		<img src="/pico.webp" alt="Picologs" class="h-9 w-9" />
		<h1 class="m-0 hidden text-xl font-medium text-white sm:block">Picologs</h1>
	</div>

	<aside class="flex flex-wrap items-center justify-end gap-3">
		<!-- Log Location Indicator (Desktop only) -->
		{#if appState.logLocation}
			<button
				class="flex items-center gap-1 rounded border border-white/5 px-2 py-1.5 text-sm font-medium text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white md:px-3"
				title="Click to change log file"
				onclick={() => appState.selectLogFile?.()}
			>
				<ScrollText size={16} />
				<span class="hidden md:inline">{appState.logLocation}</span>
			</button>
		{/if}

		<!-- Clear Logs Button (when logs exist) -->
		{#if appState.logs.length > 0}
			<button
				class="flex items-center gap-1 rounded border border-white/5 px-2 py-1.5 text-sm font-medium text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white md:px-3"
				title="Clear all logs from view"
				onclick={handleClearLogs}
			>
				<BrushCleaning size={16} />
				<span class="hidden md:inline">Clear Logs</span>
			</button>
		{/if}

		{#if user}
			<!-- Friend Code Button -->
			<button
				class="flex items-center gap-1 rounded border border-white/5 px-2 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-white/20 md:px-3"
				onclick={handleCopyFriendCode}
			>
				{#if copiedStatusVisible}
					<Check size={16} />
				{:else}
					<Copy size={16} />
				{/if}
				<p class="m-0"><span class="hidden lg:inline">Friend Code:</span> {friendCode || 'N/A'}</p>
			</button>

			<!-- Player Name Update Indicator -->
			{#if appState.isPlayerNameUpdating}
				<div class="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent">
					<Loader2 class="h-3 w-3 animate-spin" />
					<span>Updating player...</span>
				</div>
			{/if}

			<!-- Notifications Bell -->
			<div class="notifications-dropdown relative">
				<button
					popovertarget="notifications-popover"
					id="notifications-button"
					data-testid="notifications-btn"
					class="relative flex items-center justify-center p-2 text-white/60 transition-colors hover:text-white"
					title="Notifications"
				>
					<Bell size={20} />
					{#if notificationCount > 0}
						<span
							class="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white"
							data-testid="notification-badge"
						>
							{notificationCount}
						</span>
					{/if}
				</button>

				<div
					id="notifications-popover"
					popover="auto"
					class="max-h-[min(600px,80vh)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-white/5 bg-secondary shadow-xl md:w-96 text-white"
				>
						{#if appState.friendRequests.incoming.length === 0 && groupInvitations.length === 0 && pendingJoinRequests.length === 0}
							<div class="p-8 text-center text-white/60">
								<div class="mx-auto mb-2 flex justify-center opacity-50">
									<Bell size={48} />
								</div>
								<p>No pending notifications</p>
							</div>
						{:else}
							<div class="divide-y divide-white/10">
								{#each appState.friendRequests.incoming as request (request.id)}
									<div class="p-4 hover:bg-white/10">
										<div class="mb-3 flex items-start gap-3">
											<Avatar
												avatar={request.fromAvatar}
												discordId={request.fromDiscordId}
												userId={request.fromUserId}
												alt={request.fromUsername}
												size={10}
											/>
											<div class="min-w-0 flex-1">
												<p class="text-sm font-medium text-white">
													{request.fromUsername || 'Unknown User'}
												</p>
												{#if request.fromPlayer}
													<p class="text-xs text-white/60">{request.fromPlayer}</p>
												{/if}
												<p class="mt-1 text-xs text-white/40">
													{formatRelativeTime(request.createdAt)}
												</p>
											</div>
										</div>
										<div class="flex gap-2">
											<button
												onclick={() => handleAcceptFriend(request.id)}
												class="flex flex-1 items-center justify-center gap-1 rounded bg-success px-3 py-1.5 text-sm text-white transition-colors hover:bg-success/80"
											>
												Accept
											</button>
											<button
												onclick={() => handleDenyFriend(request.id)}
												class="flex flex-1 items-center justify-center gap-1 rounded border border-white/5 px-3 py-1.5 text-sm text-white transition-colors duration-200 hover:bg-white/15"
											>
												Ignore
											</button>
										</div>
									</div>
								{/each}

								{#each groupInvitations as invitation (invitation.id)}
									<div class="p-4 hover:bg-white/10">
										<div class="mb-3 flex items-start gap-3">
											<div class="flex-shrink-0">
												<Avatar
													avatar={invitation.group?.avatar}
													discordId={null}
													alt={invitation.group?.name || 'Group'}
													size={10}
													borderClass="rounded-lg"
												/>
											</div>
											<div class="min-w-0 flex-1">
												<p class="mb-1 text-xs font-semibold text-discord">Join Group Request</p>
												<p class="text-sm font-medium text-white">
													{invitation.group?.name || 'Unknown Group'}
												</p>
												<p class="text-xs text-white/60">
													Invited by {invitation.inviterUsername || 'Unknown User'}
												</p>
												<p class="mt-1 text-xs text-white/40">
													{new Date(invitation.createdAt).toLocaleDateString()}
												</p>
											</div>
										</div>
										<div class="flex gap-2">
											<button
												onclick={() => handleAcceptInvitation(invitation.id)}
												class="flex flex-1 items-center justify-center gap-1 rounded bg-success px-3 py-1.5 text-sm text-white transition-colors hover:bg-success/80"
											>
												<Check class="h-4 w-4" />
												Accept
											</button>
											<button
												onclick={() => handleDenyInvitation(invitation.id)}
												class="flex flex-1 items-center justify-center gap-1 rounded border border-white/5 px-3 py-1.5 text-sm text-white transition-colors duration-200 hover:bg-white/15"
											>
												<X class="h-4 w-4" />
												Deny
											</button>
										</div>
									</div>
								{/each}

								{#each pendingJoinRequests as joinRequest (joinRequest.id)}
									<div class="p-4 hover:bg-white/10">
										<div class="mb-3 flex items-start gap-3">
											<div class="flex-shrink-0">
												<Avatar
													avatar={joinRequest.avatar}
													discordId={null}
													alt={joinRequest.displayName || joinRequest.username}
													size={10}
												/>
											</div>
											<div class="min-w-0 flex-1">
												<p class="mb-1 text-xs font-semibold text-success">Join Request</p>
												<p class="text-sm font-medium text-white">
													{joinRequest.displayName || joinRequest.username}
												</p>
												<p class="text-xs text-white/60">
													Wants to join {joinRequest.groupName}
												</p>
												<p class="mt-1 text-xs text-white/40">
													{formatRelativeTime(joinRequest.createdAt)}
												</p>
											</div>
										</div>
										<div class="flex gap-2">
											<button
												onclick={() => handleAcceptJoinRequest(joinRequest.id, joinRequest.groupId)}
												class="flex flex-1 items-center justify-center gap-1 rounded bg-success px-3 py-1.5 text-sm text-white transition-colors hover:bg-success/80"
											>
												<Check class="h-4 w-4" />
												Accept
											</button>
											<button
												onclick={() => handleDenyJoinRequest(joinRequest.id, joinRequest.groupId)}
												class="flex flex-1 items-center justify-center gap-1 rounded border border-white/5 px-3 py-1.5 text-sm text-white transition-colors duration-200 hover:bg-white/15"
											>
												<X class="h-4 w-4" />
												Deny
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
				</div>
			</div>

			<!-- Profile Dropdown -->
			<div class="profile-dropdown relative">
				<button
					popovertarget="profile-popover"
					id="profile-button"
					class="flex cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0"
					title={connectionStatus === 'connected' ? 'Online' : connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
				>
					<div class="relative flex items-center justify-center">
						<Avatar
							avatar={user.avatar}
							discordId={user.discordId}
							userId={user.discordId || 'default'}
							alt={user.username}
							size={8}
							borderClass="border-2 transition-[border-color] duration-300 {connectionStatus === 'connected'
								? 'border-success shadow-[0_0_12px_rgba(76,175,80,0.4)]'
								: connectionStatus === 'disconnected'
									? 'border-danger'
									: 'border-warning'}"
						/>
					</div>
				</button>

				<div
					id="profile-popover"
					popover="auto"
					class="w-64 rounded-lg border border-white/5 bg-secondary shadow-xl text-white"
				>
						<!-- Profile Info -->
						<div class="border-b border-white/5 p-4">
							<div class="mb-3 flex items-center gap-3">
								<Avatar
									avatar={user.avatar}
									discordId={user.discordId}
									userId={user.discordId || 'default'}
									alt={user.username}
									size={12}
								/>
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-semibold text-white">
										{appState.displayName || 'User'}
									</p>
									<p
										class="truncate text-xs font-normal"
										class:text-success={connectionStatus === 'connected'}
										class:text-warning={connectionStatus === 'connecting'}
										class:text-danger={connectionStatus === 'disconnected'}
									>
										{connectionStatus === 'connected' ? 'Online' : connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
									</p>
								</div>
							</div>

							{#if friendCode}
								<button
									onclick={handleCopyFriendCode}
									class="group flex w-full items-center justify-between gap-2 rounded bg-white/10 px-3 py-2 text-xs transition-colors hover:bg-white/10"
								>
									<span class="text-white/60">Friend Code</span>
									<div class="flex items-center gap-2">
										<span class="font-mono text-white">{friendCode}</span>
										<Copy size={12} class="text-white/60" />
									</div>
								</button>
							{/if}
						</div>

						<!-- Actions -->
						<div class="p-2">
							<button
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
								popovertarget="profile-popover"
								popovertargetaction="hide"
								onclick={() => navigate('/profile')}
								data-testid="nav-profile"
							>
								<Settings size={16} />
								<span>Profile Settings</span>
							</button>
							<button
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
								popovertarget="profile-popover"
								popovertargetaction="hide"
								onclick={() => navigate('/friends')}
								data-testid="nav-friends"
							>
								<Users size={16} />
								<span>Friends</span>
							</button>
							<button
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
								popovertarget="profile-popover"
								popovertargetaction="hide"
								onclick={() => navigate('/groups')}
								data-testid="nav-groups"
							>
								<FolderOpen size={16} />
								<span>Groups</span>
							</button>
							<button
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
								popovertarget="profile-popover"
								popovertargetaction="hide"
								onclick={() => window.open('/download', '_blank')}
							>
								<Download size={16} />
								<span>Download App</span>
							</button>
							<button
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
								popovertarget="profile-popover"
								popovertargetaction="hide"
								onclick={handleSignOut}
								data-testid="sign-out-btn"
							>
								<LogOut size={16} />
								<span>Sign out</span>
							</button>
						</div>
				</div>
			</div>
		{:else if appState.signIn}
			<!-- Sign In Button (Desktop offline mode) -->
			<button
				class="flex items-center gap-1 rounded border border-white/5 bg-discord px-3 py-1.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-discord/80"
				onclick={() => appState.signIn?.()}
				title="Sign in with Discord"
			>
				<DiscordIcon />
				<span>Sign in with Discord</span>
			</button>
		{/if}
	</aside>
</header>

<!-- Clear Logs Confirmation Dialog -->
<Dialog
	bind:open={showClearDialog}
	title="Clear All Logs?"
	description={clearDialogDescription}
	confirmLabel="Clear Logs"
	cancelLabel="Cancel"
	variant="danger"
	onConfirm={confirmClearLogs}
>
	<p class="text-sm text-white/80">
		Are you sure you want to clear all logs from view? This action cannot be undone.
	</p>
</Dialog>

<style>
	#notifications-popover,
	#profile-popover {
		/* Reset default popover centering - CRITICAL! */
		inset: auto;
		margin: 0;

		/* Anchor positioning using implicit anchor from popovertarget */
		position: fixed;
		top: anchor(bottom);
		right: anchor(right);
		margin-top: 0.25rem;

		/* Animations - overlay keeps anchor during close animation */
		opacity: 0;
		transition: opacity 200ms, display 200ms allow-discrete, overlay 200ms allow-discrete;
	}

	#notifications-popover:popover-open,
	#profile-popover:popover-open {
		opacity: 1;

		@starting-style {
			opacity: 0;
		}
	}
</style>
