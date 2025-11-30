<script lang="ts">
  import LogItem from "./LogItem.svelte";
  import type { Log } from "@pico/types";
  import type { FleetDatabase } from "../utils/ship-utils.js";

  let {
    log,
    getUserDisplayName = undefined,
    fleet = undefined,
    depth = 0,
    alternateBackground = false,
  }: {
    /** The log item (parent) with potential children */
    log: Log;
    /** Optional function to get display name for a userId */
    getUserDisplayName?: (userId: string) => string | null;
    /** Fleet database for ship lookups */
    fleet?: FleetDatabase;
    /** Current depth level for recursive nesting (internal use) */
    depth?: number;
    /** Whether to apply alternating background color */
    alternateBackground?: boolean;
  } = $props();

  // Local state for open/closed (no prop mutation)
  let isOpen = $state(log.open ?? false);

  // Local state for tracking which children are open (keyed by child.id)
  let childrenOpenState = $state<Record<string, boolean>>({});

  // Initialize children open state from log.children
  $effect(() => {
    if (log.children) {
      for (const child of log.children) {
        if (childrenOpenState[child.id] === undefined) {
          childrenOpenState[child.id] = child.open ?? false;
        }
      }
    }
  });

  // Get display name for the current log
  const username = $derived(
    getUserDisplayName ? getUserDisplayName(log.userId) : null,
  );

  // Check if this log has children to render
  const hasChildren = $derived(log.children && log.children.length > 0);

  // Determine gradient color based on event type
  const gradientColor = $derived(
    log.eventType === "killing_spree" ? "239 68 68" : "96 165 250",
  );

  // Maximum depth to prevent infinite recursion
  const MAX_DEPTH = 5;
</script>

<!-- Parent log item -->
<div class="w-full {alternateBackground ? 'bg-white/[0.02]' : ''}">
  <LogItem
    {...log}
    original={hasChildren && isOpen ? undefined : log.original}
    bind:open={isOpen}
    {fleet}
    reportedBy={username ? [username] : undefined}
  />
</div>

<!-- Children (recursive rendering with indentation and styling) -->
{#if isOpen && hasChildren && depth < MAX_DEPTH}
  <div
    class="relative pl-14 group-divider"
    style="--gradient-color: {gradientColor};"
  >
    {#each log.children as child (child.id)}
      {@const childUsername = getUserDisplayName
        ? getUserDisplayName(child.userId)
        : null}
      <!-- Render child with LogItem directly (children don't have further nesting in current design) -->
      <LogItem
        {...child}
        bind:open={childrenOpenState[child.id]}
        {fleet}
        child={true}
        reportedBy={childUsername ? [childUsername] : undefined}
      />

      <!-- Support recursive nesting if child has children (uncomment if needed) -->
      <!-- {#if child.children && child.children.length > 0}
				<svelte:self
					log={child}
					{getUserDisplayName}
					depth={depth + 1}
					alternateBackground={false}
				/>
			{/if} -->
    {/each}
  </div>
{/if}

<style>
  .group-divider {
    /* Show a vertical 4px left-side gradient divider */
    position: relative;
    /* fallback solid for older browsers */
    box-shadow: 4px 0 0 0 rgba(255, 255, 255, 0.1);

    /* use gradient for supported browsers */
    &::before {
      content: "";
      position: absolute;
      left: 31px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(
        to bottom,
        rgba(var(--gradient-color) / 0.6),
        rgba(var(--gradient-color) / 0)
      );
      border-radius: 2px;
      opacity: 1;
      pointer-events: none;
      z-index: 0;
    }
  }
</style>
