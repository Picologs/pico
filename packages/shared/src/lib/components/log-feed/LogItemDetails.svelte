<script lang="ts">
	/**
	 * LogItemDetails - Display original log text with copy button
	 *
	 * Shows the raw log text in an expanded view with a copy button.
	 * Only visible when log item is expanded (open).
	 */

	import LogItemCopyButton from './LogItemCopyButton.svelte';

	let {
		original = ''
	}: {
		/** Original raw log text */
		original?: string;
	} = $props();
</script>

{#if original && original.trim()}
	<div
		class="relative mt-2 rounded-lg bg-white/10 p-2 pr-10 text-left text-xs break-all text-white/70"
	>
		<LogItemCopyButton text={original} size={16} />
		{original}
	</div>
{/if}
