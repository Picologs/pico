<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '@lucide/svelte';

	/**
	 * Dialog component following Svelte 5 and Tailwind CSS 4 best practices
	 * Uses native <dialog> element with proper accessibility
	 */

	interface Props {
		/**
		 * Controls dialog visibility (bindable)
		 */
		open?: boolean;

		/**
		 * Dialog title (required for accessibility)
		 */
		title: string;

		/**
		 * Optional description text
		 */
		description?: string;

		/**
		 * Dialog content (snippet)
		 */
		children: Snippet;

		/**
		 * Optional footer content (snippet) - overrides default footer
		 */
		footer?: Snippet;

		/**
		 * Called when dialog is confirmed
		 */
		onConfirm?: () => void | Promise<void>;

		/**
		 * Called when dialog is cancelled
		 */
		onCancel?: () => void;

		/**
		 * Size variant
		 */
		size?: 'sm' | 'md' | 'lg' | 'xl';

		/**
		 * Style variant
		 */
		variant?: 'default' | 'danger' | 'success';

		/**
		 * Confirm button label
		 */
		confirmLabel?: string;

		/**
		 * Cancel button label
		 */
		cancelLabel?: string;

		/**
		 * Show footer buttons
		 */
		showFooter?: boolean;

		/**
		 * Disable confirm button while processing
		 */
		loading?: boolean;

		/**
		 * Disable the confirm button based on external validation
		 */
		disableConfirm?: boolean;
	}

	let {
		open = $bindable(false),
		title,
		description,
		children,
		footer,
		onConfirm,
		onCancel,
		size = 'md',
		variant = 'default',
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		showFooter = true,
		loading = false,
		disableConfirm = false
	}: Props = $props();

	let dialogRef: HTMLDialogElement | undefined = $state();
	let isOpen = $state(false);
	let isProcessing = $state(false);

	// Size classes
	const sizeClasses = {
		sm: 'max-w-md',
		md: 'max-w-xl',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl'
	};

	// Variant classes for confirm button
	const variantClasses = {
		default: 'bg-discord hover:bg-discord/80 focus:ring-discord',
		danger: 'bg-danger hover:bg-danger/80 focus:ring-danger',
		success: 'bg-success hover:bg-success/80 focus:ring-success'
	};

	// Sync dialog state with open prop
	$effect(() => {
		if (open && dialogRef && !dialogRef.open) {
			dialogRef.showModal();
			isOpen = true;
		} else if (!open && dialogRef?.open) {
			dialogRef.close();
			isOpen = false;
		}
	});

	async function handleConfirm() {
		if (isProcessing || loading || disableConfirm) return;

		isProcessing = true;
		try {
			await onConfirm?.();
			open = false;
		} catch (error) {
			console.error('Dialog confirm error:', error);
		} finally {
			isProcessing = false;
		}
	}

	function handleCancel() {
		if (isProcessing || loading) return;
		onCancel?.();
		open = false;
	}

	function handleClose() {
		if (isProcessing || loading) return;
		open = false;
	}

</script>

<dialog
	bind:this={dialogRef}
	onclose={handleClose}
	aria-labelledby="dialog-title"
	aria-describedby={description ? 'dialog-description' : undefined}
	aria-modal="true"
	style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); margin: 0; padding: 0;"
	class="
		w-full
		rounded-lg
		border
		border-white/5
		bg-secondary
		shadow-xl
		backdrop:bg-black/50
		backdrop:backdrop-blur-sm
		{sizeClasses[size]}
	"
>
	{#if isOpen}
		<div
			role="none"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			class="flex flex-col gap-4 py-4"
		>
			<!-- Header -->
			<div class="flex items-start justify-between px-6">
				<div class="flex-1">
					<h2 id="dialog-title" class="text-xl font-semibold text-white">
						{title}
					</h2>
					{#if description}
						<p id="dialog-description" class="text-sm text-white/70">
							{description}
						</p>
					{/if}
				</div>
				<button
					type="button"
					onclick={handleCancel}
					disabled={isProcessing || loading}
					class="
						-mt-1 -mr-2
						rounded-md
						p-1.5
						text-white/60
						transition-colors
						hover:bg-white/10
						hover:text-white
						disabled:cursor-not-allowed
						disabled:opacity-50
					"
					aria-label="Close dialog"
				>
					<X size={20} />
				</button>
			</div>

			<!-- Content -->
			<div class="px-6">
				{@render children()}
			</div>

			<!-- Footer -->
			{#if showFooter}
				{#if footer}
					<div class="border-t border-white/10 px-6 pt-4">
						{@render footer()}
					</div>
				{:else}
					<div class="flex justify-end gap-3 border-t border-white/10 px-6 pt-4">
						<button
							type="button"
							onclick={handleCancel}
							disabled={isProcessing || loading}
							class="
								rounded-md bg-white/5
								px-4
								py-2
								text-sm
								font-medium
								text-white/80
								transition-colors
								hover:bg-white/10
								hover:text-white
								disabled:cursor-not-allowed
								disabled:opacity-50
							"
						>
							{cancelLabel}
						</button>
						<button
							type="button"
							onclick={handleConfirm}
							disabled={isProcessing || loading || disableConfirm}
							class="
								px-4 py-2
								text-sm
								font-medium
								text-white
								{variantClasses[variant]}
								flex
								items-center
								gap-2
								rounded-md
								transition-colors
								focus:ring-2
								focus:ring-offset-2
								focus:outline-none disabled:cursor-not-allowed disabled:opacity-50
							"
						>
							{confirmLabel}
						</button>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</dialog>
