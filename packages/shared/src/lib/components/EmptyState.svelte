<script lang="ts">
	/**
	 * EmptyState Component
	 *
	 * A reusable empty state component that displays when content is not available.
	 * Supports custom icons, messages, and content snippets for flexibility across applications.
	 *
	 * Design System:
	 * - Background: Subtle overlay (bg-overlay-card)
	 * - Border: Light border (border-white/10)
	 * - Text: Muted text color (text-white/60)
	 * - Icon: Large emoji or icon (text-6xl)
	 * - Spacing: Consistent gap and padding
	 *
	 * Usage Examples:
	 *
	 * 1. Simple empty state with icon and message:
	 * ```svelte
	 * <EmptyState icon="📡" message="No logs yet. Waiting for activity..." />
	 * ```
	 *
	 * 2. Empty state with custom content snippet:
	 * ```svelte
	 * <EmptyState icon="📡">
	 *   {#snippet content()}
	 *     <span>Custom content here with <button>interactive elements</button></span>
	 *   {/snippet}
	 * </EmptyState>
	 * ```
	 *
	 * 3. Getting started guide:
	 * ```svelte
	 * <EmptyState icon="🚀" title="Getting started">
	 *   {#snippet content()}
	 *     <ol class="list-none pl-0 [counter-reset:step] flex flex-col gap-2 mt-4">
	 *       <li class="step-item">Step 1 content</li>
	 *       <li class="step-item">Step 2 content</li>
	 *     </ol>
	 *   {/snippet}
	 * </EmptyState>
	 * ```
	 *
	 * 4. Centered variant (default for simple messages):
	 * ```svelte
	 * <EmptyState icon="📭" message="No friends yet" variant="centered" />
	 * ```
	 *
	 * 5. Card variant (for more complex content):
	 * ```svelte
	 * <EmptyState icon="🚀" title="Getting started" variant="card">
	 *   {#snippet content()}
	 *     <p>Detailed instructions here...</p>
	 *   {/snippet}
	 * </EmptyState>
	 * ```
	 */

	let {
		icon = '📡',
		message = undefined,
		title = undefined,
		content,
		variant = 'centered',
		class: className = ''
	}: {
		/** Icon to display (emoji or text) */
		icon?: string;
		/** Simple message text (only used if content snippet is not provided) */
		message?: string;
		/** Optional title (shown above content) */
		title?: string;
		/** Custom content snippet (overrides message) */
		content?: import('svelte').Snippet;
		/** Display variant: 'centered' for simple states, 'card' for complex content */
		variant?: 'centered' | 'card';
		/** Additional CSS classes */
		class?: string;
	} = $props();
</script>

{#if variant === 'centered'}
	<!-- Centered variant: Simple empty state for lists, feeds, etc. -->
	<div class="flex h-full flex-col items-center justify-center gap-4 {className}">
		<div class="text-6xl">{icon}</div>
		<div class="px-4 text-center text-base text-white/60">
			{#if content}
				{@render content()}
			{:else if message}
				{message}
			{/if}
		</div>
	</div>
{:else if variant === 'card'}
	<!-- Card variant: For more complex content with optional title -->
	<div
		class="mx-auto my-8 flex max-w-[600px] flex-col items-start gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-8 {className}"
	>
		{#if title}
			<h2 class="m-0 mb-2 text-[1.6rem] font-medium">
				{icon}
				{title}
			</h2>
		{:else}
			<div class="text-6xl">{icon}</div>
		{/if}

		<div class="w-full text-base text-white/60">
			{#if content}
				{@render content()}
			{:else if message}
				<p class="m-0">{message}</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	/**
	 * Custom styles for numbered list items in getting started guides.
	 * Apply 'step-item' class to <li> elements for automatic numbering with styled badges.
	 */
	:global(.step-item) {
		display: inline-block;
		position: relative;
		padding-left: 34px;
		margin: 0;
		font-size: 1rem;
		font-weight: 300;
		line-height: 1.6;
	}

	:global(.step-item::before) {
		content: counter(step);
		counter-increment: step;
		position: absolute;
		left: 0;
		top: 0;
		width: 1.5rem;
		height: 1.5rem;
		background: var(--color-success);
		color: white;
		border-radius: 9999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85em;
		font-weight: bold;
		line-height: 1.5rem;
	}

	/* Initialize counter for step items */
	:global(ol:has(.step-item)) {
		counter-reset: step;
	}
</style>
