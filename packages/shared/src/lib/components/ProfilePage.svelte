<script lang="ts">
	import { Save, Trash2, LoaderCircle } from '@lucide/svelte';
	import PageLayout from './PageLayout.svelte';
	import Dialog from './Dialog.svelte';
	import type { NotificationCallback, NotificationType } from '../types/notifications.js';
	import type { UserProfile, ProfileUpdateData } from '@pico/types';
	import { appState } from '../app.svelte.js';

	// Props - now optional, will use context if not provided
	interface Props {
		userProfile?: UserProfile | null;
		onProfileUpdated?: (data: ProfileUpdateData) => void;
		onAfterDelete?: () => void | Promise<void>;
		onNotification?: NotificationCallback;
	}

	let {
		userProfile: userProfileProp,
		onProfileUpdated,
		onAfterDelete,
		onNotification
	}: Props = $props();

	// Use prop if provided, otherwise get from appState
	const userProfile = $derived(userProfileProp ?? appState?.user ?? null);

	// Helper to notify - use callback if provided, otherwise use appState toast
	const notify = (message: string, type: NotificationType) => {
		if (onNotification) {
			(onNotification as (message: string, type: NotificationType) => void)(message, type);
		} else if (appState?.addToast) {
			appState.addToast(message, type);
		} else {
			console.warn('No notification handler available:', message, type);
		}
	};

	// Helper to trigger signout - use callback if provided, otherwise trigger form submission
	const triggerSignout = async () => {
		if (onAfterDelete) {
			await onAfterDelete();
		} else if (typeof window !== 'undefined') {
			// Find and submit the signout form (standard pattern for SvelteKit apps)
			const form = document.querySelector<HTMLFormElement>('form[action="/auth/signout"]');
			if (form) {
				form.submit();
			} else {
				console.warn('Signout form not found');
			}
		}
	};

	// Form state - initialize once from userProfile, then maintain independent state
	// This prevents unwanted resets when userProfile updates after save
	let player = $state('');
	let usePlayerAsDisplayName = $state(false);
	let showTimezone = $state(true);
	let saving = $state(false);

	// Initialize form state from userProfile once
	let initialized = $state(false);
	$effect(() => {
		if (!initialized && userProfile) {
			player = userProfile.player || '';
			usePlayerAsDisplayName = userProfile.usePlayerAsDisplayName ?? false;
			showTimezone = userProfile.showTimezone ?? true;
			initialized = true;
		}
	});
	let deleting = $state(false);
	let showDeleteDialog = $state(false);
	let deleteConfirmation = $state('');

	// Get system timezone for display
	function getSystemTimezone(): string {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch {
			return 'UTC';
		}
	}

	// Check if form has changes
	let hasChanges = $derived(
		player !== (userProfile?.player || '') ||
			usePlayerAsDisplayName !== (userProfile?.usePlayerAsDisplayName ?? false) ||
			showTimezone !== (userProfile?.showTimezone ?? true)
	);

	// Check if avatar is a valid Discord avatar hash (not just a default avatar index)
	function isValidAvatarHash(avatar: string | null | undefined): boolean {
		if (!avatar) return false;
		// Discord avatar hashes are alphanumeric strings (usually 32 chars)
		// Default avatars are just single digits (0-5), which are not valid custom avatars
		const cleanAvatar = avatar.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
		return cleanAvatar.length > 2 && /^[a-zA-Z0-9_]+$/.test(cleanAvatar);
	}

	// Get Discord avatar URL
	function getAvatarUrl(): string | null {
		if (
			!userProfile ||
			!userProfile.avatar ||
			!userProfile.discordId ||
			!isValidAvatarHash(userProfile.avatar)
		)
			return null;

		if (userProfile.avatar.startsWith('http')) {
			return userProfile.avatar;
		}
		// Strip extension to avoid double .png.png
		const avatarHash = userProfile.avatar.replace(/\.(png|jpg|jpeg|gif|webp)$/i, '');
		return `https://cdn.discordapp.com/avatars/${userProfile.discordId}/${avatarHash}.png?size=128`;
	}

	// Form validation
	function validateForm(): boolean {
		if (player.trim().length === 0) {
			notify('Star Citizen player name is required', 'error');
			return false;
		}

		if (player.length > 100) {
			notify('Player name is too long (max 100 characters)', 'error');
			return false;
		}

		return true;
	}

	// Save profile changes
	async function handleSave() {
		if (!validateForm()) return;

		if (!userProfile) {
			notify('Profile not loaded. Please refresh the page.', 'error');
			return;
		}

		saving = true;

		try {
			const profileData = {
				player: player.trim(),
				timeZone: getSystemTimezone(),
				usePlayerAsDisplayName: usePlayerAsDisplayName,
				showTimezone: showTimezone
			};

			await appState.updateProfile({
				player: profileData.player,
				timeZone: profileData.timeZone,
				usePlayerAsDisplayName: profileData.usePlayerAsDisplayName,
				showTimezone: profileData.showTimezone
			});

			notify('Profile updated successfully', 'success');

			// Notify parent of the update if callback provided
			if (onProfileUpdated) {
				onProfileUpdated(profileData);
			}
		} catch (error) {
			// Rollback local state on error
			player = userProfile.player || '';
			usePlayerAsDisplayName = userProfile.usePlayerAsDisplayName ?? false;
			showTimezone = userProfile.showTimezone ?? true;

			// Show appropriate error message
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to save profile. Please try again.';
			notify(errorMessage, 'error');
		} finally {
			saving = false;
		}
	}

	// Open delete confirmation dialog
	function openDeleteDialog() {
		if (!userProfile) {
			notify('Profile not loaded. Please refresh the page.', 'error');
			return;
		}
		deleteConfirmation = '';
		showDeleteDialog = true;
	}

	// Delete profile
	async function handleDelete() {
		deleting = true;
		try {
			await appState.deleteProfile();
			notify('Profile deleted successfully', 'success');

			// Trigger signout (will submit form or use callback)
			await triggerSignout();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to delete profile. Please try again.';
			notify(errorMessage, 'error');
		} finally {
			deleting = false;
			showDeleteDialog = false;
		}
	}

	// Validate delete confirmation
	let isDeleteValid = $derived(deleteConfirmation === 'DELETE');

	// Get user's initial for avatar fallback
	function getUserInitial(): string {
		const username = userProfile?.username;
		return (username || '?')[0].toUpperCase();
	}

	// Get display name based on settings
	function getDisplayName(): string {
		if (usePlayerAsDisplayName && player) {
			return player;
		}
		return userProfile?.username || 'Unknown';
	}

	// Get current time in system timezone
	function getCurrentTime(): string {
		try {
			const now = new Date();
			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: getSystemTimezone(),
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
			return formatter.format(now);
		} catch {
			return new Date().toLocaleTimeString('en-US', {
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
		}
	}

	// Get timezone location
	function getTimezoneLocation(): string {
		const tz = getSystemTimezone();
		const parts = tz.split('/');
		return parts.length >= 2 ? parts.slice(1).join('/').replace(/_/g, ' ') : tz;
	}

	// Update time every minute via global ticker
	import { useTimestampTicker } from '../utils/timestampTicker.svelte.js';
	const ticker = useTimestampTicker();

	let currentTime = $derived.by(() => {
		ticker.tick; // Subscribe to ticker updates
		return getCurrentTime();
	});
</script>

<PageLayout title="Profile" description="Manage your account settings and preferences">
	{#if !userProfile}
		<div class="rounded-lg border border-white/5 bg-secondary p-8 text-center">
			<div class="text-lg text-white/40">Loading profile...</div>
		</div>
	{:else}
		<div class="rounded-lg border border-white/5 bg-secondary p-6">
			<!-- Discord Account Section (Read-only) -->
			<div class="mb-6 pb-6">
				<div class="flex items-center gap-4">
					{#if getAvatarUrl()}
						<img
							src={getAvatarUrl()}
							alt={getDisplayName()}
							class="h-16 w-16 flex-shrink-0 rounded-full"
						/>
					{:else}
						<div
							class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10"
						>
							<span class="text-3xl text-white/60">{getUserInitial()}</span>
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<h3 class="truncate text-sm font-semibold text-white">
							{getDisplayName()}
						</h3>
						{#if showTimezone}
							<p class="mt-1 text-xs text-white/40">{currentTime} ({getTimezoneLocation()})</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Editable Fields -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSave();
				}}
			>
				<!-- Player Name -->
				<div class="mb-6">
					<label for="player" class="mb-2 block text-sm font-medium text-white/80">
						Star Citizen Player Name
					</label>
					<input
						id="player"
						type="text"
						bind:value={player}
						placeholder="Auto-populated from game logs"
						disabled
						maxlength="100"
						class="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 placeholder-white/40 cursor-not-allowed opacity-75"
					/>
					<p class="mt-1 text-xs text-white/50">
						Automatically detected from Star Citizen logs via desktop app
					</p>
				</div>

				<!-- Use Player Name as Display Name -->
				<div class="mb-6">
					<label class="group flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							bind:checked={usePlayerAsDisplayName}
							class="h-4 w-4 shrink-0 cursor-pointer rounded border-white/10 bg-white/5 accent-discord focus:ring-2 focus:ring-discord focus:ring-offset-0"
						/>
						<div class="flex-1">
							<span
								class="text-sm font-medium text-white/80 transition-colors group-hover:text-white"
							>
								Use Star Citizen name as display name
							</span>
						</div>
					</label>
				</div>

				<!-- Show Timezone -->
				<div class="mb-6">
					<label class="group flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							bind:checked={showTimezone}
							class="h-4 w-4 shrink-0 cursor-pointer rounded border-white/10 bg-white/5 accent-discord focus:ring-2 focus:ring-discord focus:ring-offset-0"
						/>
						<div class="flex-1">
							<span
								class="text-sm font-medium text-white/80 transition-colors group-hover:text-white"
							>
								Show timezone on profile
							</span>
						</div>
					</label>
				</div>

				<!-- Save Button -->
				<div class="flex items-center gap-4">
					<button
						type="submit"
						disabled={saving}
						class="inline-flex items-center gap-2 rounded-md bg-success px-4 py-2 font-medium text-white transition-colors hover:bg-success/80 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<Save size={20} />
						<span>{saving ? 'Saving...' : 'Save Changes'}</span>
					</button>
				</div>
			</form>
		</div>

		<!-- Danger Zone - Delete Profile -->
		<div class="mt-6 rounded-lg border border-white/5 bg-secondary p-6">
			<h3 class="mb-2 text-sm font-semibold text-danger">Danger Zone</h3>
			<p class="mb-4 text-xs text-white/60">
				Once you delete your profile, there is no going back. Please be certain.
			</p>
			<button
				type="button"
				onclick={openDeleteDialog}
				disabled={deleting || saving}
				class="inline-flex items-center gap-2 rounded-md bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/80 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Trash2 size={20} />
				<span>Delete My Profile</span>
			</button>
		</div>
	{/if}
</PageLayout>

<!-- Delete Confirmation Dialog -->
<Dialog
	bind:open={showDeleteDialog}
	title="Delete Profile"
	description="This action cannot be undone and will permanently delete your profile information."
	variant="danger"
	confirmLabel="Delete Profile"
	loading={deleting}
	disableConfirm={!isDeleteValid}
	onConfirm={handleDelete}
	onCancel={() => (deleteConfirmation = '')}
>
	<div class="space-y-4">
		<ul class="list-inside list-disc space-y-2 text-sm text-white/70">
			<li>Your profile information</li>
			<li>Your Star Citizen player name</li>
			<li>All your settings</li>
		</ul>

		<div>
			<label for="delete-confirmation" class="mb-2 block text-sm font-medium text-white/80">
				Type <strong class="text-danger">DELETE</strong> to confirm:
			</label>
			<input
				id="delete-confirmation"
				type="text"
				bind:value={deleteConfirmation}
				placeholder="DELETE"
				class="w-full rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white placeholder-white/40 transition-all focus:border-danger focus:ring-2 focus:ring-danger focus:outline-none"
			/>
		</div>
	</div>
</Dialog>
