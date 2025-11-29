<script lang="ts">
	import { fade } from 'svelte/transition';
	import { Check, X, Info } from '@lucide/svelte';

	export interface ToastNotification {
		id: string;
		message: string;
		type: 'success' | 'error' | 'info';
		customIcon?: string;
		avatarUrl?: string;
		autoDismiss?: boolean;
	}

	let {
		notifications = [],
		autoRemove = true,
		duration = 5000,
		onRemove,
		showClearAll = false,
		onClearAll
	}: {
		notifications: ToastNotification[];
		autoRemove?: boolean;
		duration?: number;
		onRemove?: (id: string) => void;
		showClearAll?: boolean;
		onClearAll?: () => void;
	} = $props();

	// Element reference for popover API
	let containerRef = $state<HTMLDivElement>();

	// Manage popover visibility based on notifications
	$effect(() => {
		if (!containerRef) return;

		try {
			const isOpen = containerRef.matches(':popover-open');

			if (notifications.length > 0 && !isOpen) {
				containerRef.showPopover();
			} else if (notifications.length === 0 && isOpen) {
				containerRef.hidePopover();
			}
		} catch (error) {
			// Graceful degradation if Popover API not supported
			console.warn('Popover API not supported:', error);
		}
	});

	// Track active timeouts per notification to prevent resetting timers
	const activeTimeouts = new Map<string, number>();

	// Auto-remove notifications after duration
	$effect(() => {
		if (notifications.length === 0) {
			// Clear all timeouts when notifications are empty
			activeTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
			activeTimeouts.clear();
			return;
		}

		// Create timeouts only for NEW notifications that don't have one yet
		notifications.forEach((notification) => {
			// Skip if this notification already has an active timeout
			if (activeTimeouts.has(notification.id)) return;

			// Check if this notification should auto-dismiss
			const shouldAutoDismiss =
				notification.autoDismiss !== undefined ? notification.autoDismiss : autoRemove;

			if (shouldAutoDismiss) {
				const timeoutId = window.setTimeout(() => {
					activeTimeouts.delete(notification.id);
					if (onRemove) {
						onRemove(notification.id);
					}
				}, duration);
				activeTimeouts.set(notification.id, timeoutId);
			}
		});

		// Cleanup: clear timeouts for notifications that were removed from the array
		return () => {
			const currentIds = new Set(notifications.map((n) => n.id));
			Array.from(activeTimeouts.entries()).forEach(([id, timeoutId]) => {
				if (!currentIds.has(id)) {
					window.clearTimeout(timeoutId);
					activeTimeouts.delete(id);
				}
			});
		};
	});

	function handleClearAll() {
		if (onClearAll) {
			onClearAll();
		}
	}
</script>

<div bind:this={containerRef} popover="manual" class="toast-container">
	{#if showClearAll && notifications.length > 1}
		<div class="mb-1 flex justify-end">
			<button
				onclick={handleClearAll}
				class="rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
			>
				Clear all
			</button>
		</div>
	{/if}
	{#each notifications as notification (notification.id)}
		<div
			in:fade={{ duration: 200 }}
			out:fade={{ duration: 200 }}
			data-testid="toast"
			data-toast-type={notification.type}
			class="flex items-center gap-3 rounded-lg border-t border-r border-b border-l-4 border-gray-700 bg-gray-800 px-4 py-3 shadow-xl transition-all duration-300"
			class:border-l-success={notification.type === 'success'}
			class:border-l-danger={notification.type === 'error'}
			class:border-l-discord={notification.type === 'info'}
		>
			<div
				class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
				class:bg-success={notification.type === 'success' && !notification.avatarUrl}
				class:bg-danger={notification.type === 'error' && !notification.avatarUrl}
				class:bg-discord={notification.type === 'info' && !notification.avatarUrl}
			>
				{#if notification.avatarUrl}
					<img
						src={notification.avatarUrl}
						alt="Avatar"
						class="h-6 w-6 rounded-full object-cover"
					/>
				{:else if notification.customIcon}
					<span class="text-sm font-bold text-white">
						{notification.customIcon}
					</span>
				{:else if notification.type === 'success'}
					<Check size={16} class="text-white" />
				{:else if notification.type === 'error'}
					<X size={16} class="text-white" />
				{:else}
					<Info size={16} class="text-white" />
				{/if}
			</div>
			<p class="flex-1 text-sm font-medium text-white">{notification.message}</p>
			{#if onRemove}
				<button
					onclick={() => onRemove(notification.id)}
					class="ml-2 flex-shrink-0 text-gray-400 transition-colors hover:text-white"
					aria-label="Dismiss notification"
				>
					<X size={16} />
				</button>
			{/if}
		</div>
	{/each}
</div>

<style>
	/* Higher specificity selector to override browser UA popover defaults */
	[popover].toast-container {
		/* Explicit positioning resets to override Popover API defaults */
		position: fixed !important;
		inset: auto !important;      /* Reset all sides first */
		top: auto !important;        /* Explicit override */
		left: auto !important;       /* Explicit override */
		right: 1rem !important;      /* Position from right edge */
		bottom: 1rem !important;     /* Position from bottom edge */
		margin: 0 !important;
		max-width: 28rem;
		z-index: 9999;

		/* Remove default popover styling */
		border: none;
		background: transparent;
		padding: 0;

		/* Stack toasts vertically */
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Additional webkit compatibility for Tauri */
	[popover].toast-container:popover-open {
		position: fixed !important;
		inset: auto !important;      /* Reset all sides first */
		top: auto !important;        /* Explicit override */
		left: auto !important;       /* Explicit override */
		right: 1rem !important;      /* Position from right edge */
		bottom: 1rem !important;     /* Position from bottom edge */
		margin: 0 !important;
	}
</style>
