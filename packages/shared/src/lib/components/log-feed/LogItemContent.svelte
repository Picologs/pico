<script lang="ts">
	/**
	 * LogItemContent - Main content area of log item
	 *
	 * Combines text, metadata, and details components.
	 * Manages the display of expanded/collapsed state.
	 */

	import LogItemText from './LogItemText.svelte';
	import LogItemMetadata from './LogItemMetadata.svelte';
	import LogItemDetails from './LogItemDetails.svelte';
	import type { Log } from '@pico/types';

	let {
		eventType = undefined,
		line,
		metadata = undefined,
		player,
		timestamp,
		reportedBy = undefined,
		original = '',
		isOpen = false,
		isChild = false
	}: {
		/** Type of log event */
		eventType?: Log['eventType'];
		/** Formatted log line text */
		line: string;
		/** Additional metadata for the log */
		metadata?: Log['metadata'];
		/** Player name */
		player: string | null;
		/** ISO 8601 timestamp */
		timestamp: string;
		/** List of usernames who reported this log */
		reportedBy?: string[];
		/** Original raw log text */
		original?: string;
		/** Whether the log item is expanded */
		isOpen?: boolean;
		/** Whether this is a child item (smaller font) */
		isChild?: boolean;
	} = $props();
</script>

<div class="min-w-0 overflow-hidden">
	<LogItemText {eventType} {line} {metadata} {player} {isOpen} {isChild} />
	<LogItemMetadata {timestamp} {reportedBy} {player} {isChild} {isOpen} />
	{#if isOpen}
		<LogItemDetails {original} />
	{/if}
</div>
