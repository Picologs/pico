<script lang="ts">
	/**
	 * Skeleton loader component for displaying loading placeholders
	 * Mimics the structure of user/friend items in lists
	 */
	interface Props {
		/** Number of skeleton items to display */
		count?: number;
	}

	let { count = 3 }: Props = $props();

	// Create array with unique keys to avoid Svelte each_key_duplicate errors
	const items = $derived(Array.from({ length: count }, (_, i) => `skeleton-${i}`));
</script>

<div class="flex flex-col gap-3">
	{#each items as item (item)}
		<div class="flex items-center gap-3 rounded-lg">
			<!-- Avatar skeleton -->
			<div class="h-8 w-8 shrink-0 rounded-full bg-white/10"></div>

			<!-- Text skeleton -->
			<div class="flex flex-1 flex-col gap-2">
				<div class="h-3 w-3/4 rounded bg-white/10"></div>
				<div class="h-2 w-1/2 rounded bg-white/5"></div>
			</div>
		</div>
	{/each}
</div>
