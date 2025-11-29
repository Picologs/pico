<script lang="ts">
	/**
	 * LogItemMetadata - Display timestamp and reporter info
	 *
	 * Shows relative time and who reported the log.
	 * Updates timestamp every minute via global ticker (CPU efficient).
	 */

	import { formatDistance } from 'date-fns';
	import { useTimestampTicker } from '../../utils/timestampTicker.svelte.js';

	let {
		timestamp,
		reportedBy = undefined,
		player,
		isChild = false,
		isOpen = false
	}: {
		/** ISO 8601 timestamp */
		timestamp: string;
		/** List of usernames who reported this log */
		reportedBy?: string[];
		/** Player name from the log */
		player: string | null;
		/** Whether this is a child item (smaller font) */
		isChild?: boolean;
		/** Whether the log item is expanded */
		isOpen?: boolean;
	} = $props();

	const formatDate = (date: string) => {
		return formatDistance(new Date(date), new Date(), { addSuffix: true });
	};

	// Subscribe to global ticker (single 60s interval for all components)
	const ticker = useTimestampTicker();

	// Recompute timestamp when ticker updates
	let formattedTimestamp = $derived.by(() => {
		ticker.tick; // Subscribe to ticker updates
		return formatDate(timestamp);
	});
</script>

<div
	class="text-left text-white/50 {isOpen ? '' : 'truncate'} {isChild ? 'text-[0.5rem]' : 'text-xs'}"
>
	{formattedTimestamp}, {reportedBy ? reportedBy.join(', ') : player}
</div>
