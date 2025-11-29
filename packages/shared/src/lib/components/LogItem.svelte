<script lang="ts">
  /**
   * LogItem - Display a single log entry
   *
   * Refactored to use sub-components for better maintainability.
   * Handles click events to toggle open/closed state.
   */

  import LogItemIcon from "./log-feed/LogItemIcon.svelte";
  import LogItemContent from "./log-feed/LogItemContent.svelte";
  import type { Log } from "@pico/types";
  import type { FleetDatabase } from "../utils/ship-utils.js";

  let {
    open = $bindable(),
    emoji,
    line,
    timestamp,
    original = "",
    player,
    metadata = undefined,
    eventType = undefined,
    reportedBy = undefined,
    fleet = undefined,
    child = false,
    userId = undefined,
  }: {
    open: boolean;
    emoji: string;
    line: string;
    timestamp: string;
    original?: string;
    player: string | null;
    metadata?: Log["metadata"];
    eventType?: Log["eventType"];
    reportedBy?: string[];
    fleet?: FleetDatabase;
    child?: boolean;
    userId?: string;
  } = $props();
</script>

<button
  data-testid="log-entry"
  data-event-type={eventType}
  class="w-full min-w-full grid items-start gap-4 px-3 py-4 text-left {child
    ? 'grid-cols-[1rem_1fr] gap-2'
    : 'grid-cols-[2.5rem_1fr]'} {eventType === 'killing_spree'
    ? 'shadow-[inset_4px_0_0_0_rgb(239_68_68)] bg-danger/10'
    : ''}"
  onclick={() => (open = !open)}
>
  <LogItemIcon {emoji} {eventType} {metadata} {fleet} {userId} isChild={child} />
  <LogItemContent
    {eventType}
    {line}
    {metadata}
    {player}
    {timestamp}
    {reportedBy}
    {original}
    isOpen={open}
    isChild={child}
  />
</button>
