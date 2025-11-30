<script lang="ts">
	import {
		Copy,
		Check,
		X,
		Loader2,
		Bell,
		LogOut,
		Settings,
		Users,
		FolderOpen,
		ScrollText,
		BrushCleaning
	} from '@lucide/svelte';
	import { Avatar, DiscordIcon, Dialog as DialogComponent, appState } from '@pico/shared';
	import type { FriendRequest, GroupInvitation } from '@pico/types';

	// Type assertion to work around TypeScript issues with Dialog component from shared-svelte
	const Dialog = DialogComponent as any;

	// Props
	interface Props {
		onClearLogs?: () => void;
	}

	let { onClearLogs }: Props = $props();

	// Internal state
	let copiedStatusVisible = $state(false);
	let showClearDialog = $state(false);

	// Processing state for friend requests and group invitations
	let processingRequests = $state(new Set<string>());

	// Derived state from appState
	const user = $derived(appState.user);
	const friendCode = $derived(appState.user?.friendCode);
	const connectionStatus = $derived(appState.connectionStatus);
	const groupInvitations = $derived(appState.groupInvitations as unknown as GroupInvitation[]);

	// Calculate notification count (only incoming friend requests)
	const notificationCount = $derived(
		appState.friendRequests.incoming.length + groupInvitations.length
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
		processingRequests.add(requestId);
		processingRequests = new Set(processingRequests);
		try {
			await appState.acceptFriendRequest(requestId);
		} catch (error) {
			console.error('[HeaderContent] Failed to accept friend request:', error);
		} finally {
			processingRequests.delete(requestId);
			processingRequests = new Set(processingRequests);
		}
	}

	async function handleDenyFriend(requestId: string) {
		processingRequests.add(requestId);
		processingRequests = new Set(processingRequests);
		try {
			await appState.denyFriendRequest(requestId);
		} catch (error) {
			console.error('[HeaderContent] Failed to deny friend request:', error);
		} finally {
			processingRequests.delete(requestId);
			processingRequests = new Set(processingRequests);
		}
	}

	// Group invitation handlers
	async function handleAcceptInvitation(invitationId: string) {
		processingRequests.add(invitationId);
		processingRequests = new Set(processingRequests);
		try {
			await appState.acceptGroupInvitation(invitationId);
		} catch (error) {
			console.error('[HeaderContent] Failed to accept group invitation:', error);
		} finally {
			processingRequests.delete(invitationId);
			processingRequests = new Set(processingRequests);
		}
	}

	async function handleDenyInvitation(invitationId: string) {
		processingRequests.add(invitationId);
		processingRequests = new Set(processingRequests);
		try {
			await appState.denyGroupInvitation(invitationId);
		} catch (error) {
			console.error('[HeaderContent] Failed to deny group invitation:', error);
		} finally {
			processingRequests.delete(invitationId);
			processingRequests = new Set(processingRequests);
		}
	}

	// Clear logs handler - always opens confirmation dialog (catch-all reset)
	function handleClearLogs() {
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

<!-- Header Controls -->
<aside class="flex flex-wrap items-center justify-end gap-3 mr-2">
	<!-- Log Location Indicator / Select File Button (Desktop only) -->
	{#if appState.selectLogFile && (user || appState.hasSelectedLog)}
		<button
			class="flex items-center gap-1 rounded border border-white/5 px-3 py-1 text-sm font-medium text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white"
			title={appState.logLocation
				? 'Click to change log file'
				: 'Select your Star Citizen log file'}
			onclick={() => appState.selectLogFile?.()}
		>
			{#if appState.logLocation}
				<ScrollText size={16} />
				<span class="hidden md:inline">{appState.logLocation}</span>
			{:else}
				<FolderOpen size={16} />
				<span class="hidden md:inline">Select Log File</span>
			{/if}
		</button>
	{/if}

	<!-- Clear Logs Button (only show when logs are present) -->
	{#if appState.logs.length > 0}
		<button
			class="flex items-center gap-1 rounded border border-white/5 px-3 py-1 text-sm font-medium text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white"
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
			class="flex items-center gap-1 rounded border border-white/5 px-2 py-1 text-sm font-medium text-white transition-colors duration-200 hover:bg-white/20 md:px-3"
			onclick={handleCopyFriendCode}
		>
			{#if copiedStatusVisible}
				<Check size={16} />
			{:else}
				<Copy size={16} />
			{/if}
			<p class="m-0"><span>Friend Code:</span> {friendCode || 'N/A'}</p>
		</button>

		<!-- Notifications Bell -->
		<div class="notifications-dropdown relative">
			<button
				popovertarget="notifications-popover"
				id="notifications-button"
				class="relative flex items-center justify-center p-2 text-white/60 transition-colors hover:text-white"
				title="Notifications"
			>
				<Bell size={20} />
				{#if notificationCount > 0}
					<span
						class="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white"
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
				{#if appState.friendRequests.incoming.length === 0 && groupInvitations.length === 0}
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
										{...{
											avatar: request.fromAvatar,
											discordId: request.fromDiscordId,
											userId: request.fromUserId,
											alt: request.fromUsername,
											size: 10
										} as any}
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
										disabled={processingRequests.has(request.id)}
										class="flex flex-1 items-center justify-center gap-1 rounded bg-success px-3 py-1.5 text-sm text-white transition-colors hover:bg-success/80 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{#if processingRequests.has(request.id)}
											Processing...
										{:else}
											Accept
										{/if}
									</button>
									<button
										onclick={() => handleDenyFriend(request.id)}
										disabled={processingRequests.has(request.id)}
										class="flex flex-1 items-center justify-center gap-1 rounded border border-white/5 px-3 py-1.5 text-sm text-white transition-colors duration-200 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
									>
										{#if processingRequests.has(request.id)}
											Processing...
										{:else}
											Ignore
										{/if}
									</button>
								</div>
							</div>
						{/each}

						{#each groupInvitations as invitation (invitation.id)}
							<div class="p-4 hover:bg-white/10">
								<div class="mb-3 flex items-start gap-3">
									{#if invitation.group?.avatar}
										<img
											src={invitation.group.avatar}
											alt={invitation.group.name}
											class="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
										/>
									{:else}
										<div class="flex-shrink-0 rounded-lg bg-discord/20 p-2">
											<Users class="h-6 w-6" />
										</div>
									{/if}
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
										disabled={processingRequests.has(invitation.id)}
										class="flex flex-1 items-center justify-center gap-1 rounded bg-success px-3 py-1.5 text-sm text-white transition-colors hover:bg-success/80 disabled:cursor-not-allowed disabled:opacity-50"
									>
										<Check class="h-4 w-4" />
										Accept
									</button>
									<button
										onclick={() => handleDenyInvitation(invitation.id)}
										disabled={processingRequests.has(invitation.id)}
										class="flex flex-1 items-center justify-center gap-1 rounded border border-white/5 px-3 py-1.5 text-sm text-white transition-colors duration-200 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
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
				title={connectionStatus === 'connected'
					? 'Online'
					: connectionStatus === 'connecting'
						? 'Connecting'
						: 'Offline'}
			>
				<div class="relative flex items-center justify-center">
					<Avatar
						{...{
							avatar: user.avatar,
							discordId: user.discordId,
							userId: user.discordId || 'default',
							alt: user.username,
							size: 7,
							borderClass: `transition-[border-color] duration-300 ${
								connectionStatus === 'connected'
									? 'border-success border-[3px]'
									: connectionStatus === 'disconnected'
										? 'border-danger border-2'
										: 'border-warning border-2'
							}`
						} as any}
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
							{...{
								avatar: user.avatar,
								discordId: user.discordId,
								userId: user.discordId || 'default',
								alt: user.username,
								size: 12
							} as any}
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
								{connectionStatus === 'connected'
									? 'Online'
									: connectionStatus === 'connecting'
										? 'Connecting'
										: 'Offline'}
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
					>
						<Settings size={16} />
						<span>Profile Settings</span>
					</button>
					<button
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
						popovertarget="profile-popover"
						popovertargetaction="hide"
						onclick={() => navigate('/friends')}
					>
						<Users size={16} />
						<span>Friends</span>
					</button>
					<button
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
						popovertarget="profile-popover"
						popovertargetaction="hide"
						onclick={() => navigate('/groups')}
					>
						<FolderOpen size={16} />
						<span>Groups</span>
					</button>
					<button
						class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
						popovertarget="profile-popover"
						popovertargetaction="hide"
						onclick={handleSignOut}
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
			data-testid="login-button"
			class="flex items-center gap-1 rounded border border-white/5 bg-discord px-3 py-1 text-sm font-medium text-white transition-colors duration-200 hover:bg-discord/80"
			onclick={() => appState.signIn?.()}
			title="Sign in with Discord"
		>
			<DiscordIcon />
			<span data-testid="discord-login-button">Sign in with Discord</span>
		</button>
	{/if}
</aside>

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
		transition:
			opacity 200ms,
			display 200ms allow-discrete,
			overlay 200ms allow-discrete;
	}

	#notifications-popover:popover-open,
	#profile-popover:popover-open {
		opacity: 1;

		@starting-style {
			opacity: 0;
		}
	}
</style>
