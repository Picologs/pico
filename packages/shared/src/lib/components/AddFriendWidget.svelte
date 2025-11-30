<script lang="ts">
	import { UserPlus } from '@lucide/svelte';

	// ============================================================================
	// Type Definitions
	// ============================================================================

	interface Props {
		disabled?: boolean;
		placeholder?: string;
		maxLength?: number;
		onSendRequest: (friendCode: string) => Promise<void>;
	}

	// ============================================================================
	// Props & State
	// ============================================================================

	let {
		disabled = false,
		placeholder = 'Enter Friend Code',
		maxLength = 8,
		onSendRequest
	}: Props = $props();

	let friendCode = $state('');
	let isSubmitting = $state(false);

	// ============================================================================
	// Event Handlers
	// ============================================================================

	async function handleSubmit() {
		if (!friendCode.trim() || isSubmitting || disabled) return;

		isSubmitting = true;
		try {
			await onSendRequest(friendCode.trim().toUpperCase());
			friendCode = ''; // Clear input on success
		} catch (error) {
			console.error('[AddFriendWidget] Error sending friend request:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleSubmit();
		}
	}
</script>

<!-- ============================================================================ -->
<!-- Widget -->
<!-- ============================================================================ -->

<div class="flex items-center gap-2" data-testid="add-friend-widget">
	<input
		type="text"
		bind:value={friendCode}
		onkeydown={handleKeyDown}
		{placeholder}
		maxlength={maxLength}
		disabled={isSubmitting || disabled}
		data-testid="friend-code-input"
		class="min-w-0 flex-1 rounded-md border border-white/5 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/40 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
	/>
	<button
		onclick={handleSubmit}
		disabled={isSubmitting || disabled || !friendCode.trim()}
		title="Send friend request"
		data-testid="send-request-btn"
		class="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-white/5 bg-white/10 px-3 py-2 text-sm text-white transition-colors duration-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/10"
	>
		<UserPlus size={16} />
		<span>{isSubmitting ? 'Sending...' : 'Add'}</span>
	</button>
</div>
