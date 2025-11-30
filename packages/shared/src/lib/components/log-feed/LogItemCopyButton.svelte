<script lang="ts">
	/**
	 * LogItemCopyButton - Copy button for log entries
	 *
	 * Displays a copy icon that switches to a check mark on successful copy.
	 * Handles clipboard API with proper event handling.
	 */

	import { Copy, Check } from '@lucide/svelte';

	let {
		text,
		size = 16
	}: {
		/** Text to copy to clipboard */
		text: string;
		/** Icon size in pixels */
		size?: number;
	} = $props();

	let copied = $state(false);

	function copyToClipboard(event: MouseEvent | KeyboardEvent) {
		event.stopPropagation();
		navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, 1500);
	}
</script>

<div
	role="button"
	tabindex="0"
	class="absolute top-2 right-2 cursor-pointer text-white/70 transition-colors hover:text-white"
	onclick={copyToClipboard}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			copyToClipboard(e);
		}
	}}
	title="Copy to clipboard"
>
	{#if copied}
		<Check {size} />
	{:else}
		<Copy {size} />
	{/if}
</div>
