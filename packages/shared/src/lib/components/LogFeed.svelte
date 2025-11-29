<script lang="ts">
  /**
   * LogFeed - Container for log display with auto-scroll and empty state
   *
   * Refactored to use LogList and EmptyState sub-components.
   * Manages scroll behavior, auto-scroll, and "Jump to present" banner.
   */

  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import { FunnelX, Trophy, Loader2 } from "@lucide/svelte";
  import LogList from "./log-feed/LogList.svelte";
  import LogTypeFilter from "./log-feed/LogTypeFilter.svelte";
  import PlayerFilter from "./log-feed/PlayerFilter.svelte";
  import Scoreboard from "./log-feed/Scoreboard.svelte";
  import EmptyState from "./EmptyState.svelte";
  import { appState } from "../app.svelte.js";
  import { calculateSessionStats } from "../utils/log-utils.js";
  import {
    processLogs,
    groupCrossPlayerEvents,
  } from "../utils/log-grouping.js";
  import type { Log } from "@pico/types";
  import type { FleetDatabase } from "../utils/ship-utils.js";

  // Cache for grouping results - prevents duplicate processing
  let lastLogsKey: string = '';
  let lastActiveGroupId: string | null = null;
  let cachedGroupedLogs: Log[] = [];

  let {
    logs = [],
    getUserDisplayName = undefined,
    fleet = undefined,
    emptyStateIcon = "📡",
    emptyStateMessage = "No new logs yet. Waiting for activity...",
    emptyStateContent,
    autoScroll = true,
    showJumpToPresent = true,
    showScoreboard = true,
    showFilterBar = true,
  }: {
    /** Array of logs to display */
    logs: Log[];
    /** Optional function to get display name for a userId */
    getUserDisplayName?: (userId: string) => string | null;
    /** Fleet database for ship lookups */
    fleet?: FleetDatabase;
    /** Icon to show in empty state */
    emptyStateIcon?: string;
    /** Message to show in empty state */
    emptyStateMessage?: string;
    /** Custom snippet for empty state content (overrides emptyStateMessage) */
    emptyStateContent?: import("svelte").Snippet;
    /** Whether to auto-scroll to bottom on new logs */
    autoScroll?: boolean;
    /** Whether to show "Jump to present" banner when scrolled up */
    showJumpToPresent?: boolean;
    /** Whether to show the scoreboard button and dialog */
    showScoreboard?: boolean;
    /** Whether to show the filter bar (type/player filters and clear button) */
    showFilterBar?: boolean;
  } = $props();

  let fileContentContainer = $state<HTMLDivElement | null>(null);
  let atTheBottom = $state(true);
  let hasScrollbar = $state(false);
  let showScrollBanner = $state(false);
  let scrollDebounceTimer: number | null = null;
  let initialScrollDone = $state(false);

  // Scoreboard component reference
  let scoreboardRef = $state<
    | { openScoreboard: () => void; closeScoreboard: () => void }
    | undefined
  >();

  // Apply grouping to logs before display (cached to prevent duplicate processing)
  // First group crash-death sequences, then apply other groupings
  // Apply cross-player grouping only when viewing group logs (activeGroupId is set)
  const groupedLogs = $derived.by(() => {
    // Early return for empty logs
    if (logs.length === 0) {
      lastLogsKey = '';
      cachedGroupedLogs = [];
      return [];
    }

    // O(1) content-based check - stable across filter context changes
    // Include middle log id for better change detection
    const midIndex = Math.floor(logs.length / 2);
    const logsKey = `${logs.length}-${logs[0].id}-${logs[midIndex]?.id || ''}-${logs[logs.length-1].id}`;
    const logsChanged = logsKey !== lastLogsKey;
    const groupIdChanged = appState.activeGroupId !== lastActiveGroupId;

    // Return cached result if nothing changed
    if (!logsChanged && !groupIdChanged && cachedGroupedLogs.length > 0) {
      return cachedGroupedLogs;
    }

    // Recompute grouping (single-pass processor handles flatten + crash-death + all groupings)
    let result = processLogs(logs);

    // Apply cross-player grouping when viewing group logs
    if (appState.activeGroupId) {
      result = groupCrossPlayerEvents(result);
    }

    // Update cache
    lastLogsKey = logsKey;
    lastActiveGroupId = appState.activeGroupId;
    cachedGroupedLogs = result;

    return result;
  });

  // Calculate session statistics
  const sessionStats = $derived(
    calculateSessionStats(appState.logs, appState.currentPlayer),
  );

  // Use scoreboard data from appState (calculated in $effect)
  const scoreboardEntries = $derived(appState.scoreboardEntries);

  function handleScroll(event: Event) {
    if (!(event.target instanceof HTMLDivElement)) {
      return;
    }
    const target = event.target;
    // Increased tolerance to 50px to handle rapid updates better
    const isAtBottom =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 50;
    const hasContent = target.scrollHeight > target.clientHeight;

    hasScrollbar = hasContent;
    atTheBottom = isAtBottom;

    // Hide banner immediately while scrolling
    showScrollBanner = false;

    // Clear existing timer
    if (scrollDebounceTimer !== null) {
      clearTimeout(scrollDebounceTimer);
    }

    // Only show banner after user has stopped scrolling for 1 second
    if (!isAtBottom && hasContent && showJumpToPresent) {
      scrollDebounceTimer = setTimeout(() => {
        showScrollBanner = true;
      }, 1000) as unknown as number;
    }
  }

  // Re-attach scroll listener when fileContentContainer changes
  $effect(() => {
    const container = fileContentContainer;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });

      return () => {
        container.removeEventListener("scroll", handleScroll);
      };
    }
  });

  // Initial scroll to bottom on page load
  $effect(() => {
    if (!initialScrollDone && fileContentContainer && logs.length > 0) {
      tick().then(() => {
        if (fileContentContainer) {
          fileContentContainer.scrollTop = fileContentContainer.scrollHeight;
          atTheBottom = true;
          initialScrollDone = true;
        }
      });
    }
  });

  // Auto-scroll to bottom when new logs arrive (if user was already at bottom)
  $effect(() => {
    // Skip during initial scroll
    if (!initialScrollDone) return;

    // Track logs length to trigger on new logs
    const logsCount = logs.length;

    // Only auto-scroll if enabled and user was at the bottom before new content arrived
    if (autoScroll && atTheBottom && fileContentContainer && logsCount > 0) {
      tick().then(() => {
        if (fileContentContainer && atTheBottom) {
          // Re-check atTheBottom in case user scrolled during tick
          fileContentContainer.scrollTop = fileContentContainer.scrollHeight;
          atTheBottom = true;
        }
      });
    }
  });

  function scrollToBottom() {
    showScrollBanner = false;
    atTheBottom = true; // Mark as at bottom so auto-scroll resumes
    if (fileContentContainer) {
      fileContentContainer.scrollTo({
        top: fileContentContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }

  function clearAllFilters() {
    appState.enableAllLogTypes();
    appState.enableAllPlayers();
  }
</script>

<div
  class="relative grid h-full overflow-hidden"
  class:grid-rows-[auto_1fr]={showFilterBar}
  class:grid-rows-[1fr]={!showFilterBar}
  data-testid="log-feed"
>
  <!-- Filter Bar -->
  {#if showFilterBar}
    <div
      class="row-start-1 row-end-2 max-h-16 border-b border-white/5 bg-black/30 px-1 py-1 overflow-hidden"
    >
      <div class="flex items-center gap-2">
        <LogTypeFilter />
        <PlayerFilter />

        <!-- Shared Clear All Button -->
        <button
          onclick={clearAllFilters}
          class="flex items-center gap-1 rounded border border-white/5 px-2 py-1 text-sm font-medium text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white"
          title="Clear all filters"
        >
          <FunnelX size={16} />
        </button>

        {#if showScoreboard}
          <!-- Scoreboard button with extra left margin for spacing -->
          <button
            onclick={() => scoreboardRef?.openScoreboard()}
            class="ml-4 flex items-center gap-1 rounded border border-white/5 bg-white/5 px-2 py-1 text-sm font-medium text-white/70 leading-none transition-colors duration-200 hover:bg-white/10 hover:text-white cursor-pointer"
            title="View Scoreboard"
          >
            <Trophy size={16} />
            <span>Scoreboard</span>
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Scrollable Log Container -->
  <div
    class="log-feed-container scrollbar-custom overflow-y-auto bg-black/20"
    class:row-start-2={showFilterBar}
    class:row-start-1={!showFilterBar}
    bind:this={fileContentContainer}
    role="main"
  >
    {#if logs.length > 0}
      <LogList
        logs={groupedLogs}
        {getUserDisplayName}
        {fleet}
      />
    {:else}
      <EmptyState
        icon={emptyStateIcon}
        message={emptyStateMessage}
        content={emptyStateContent}
        variant="centered"
      />
    {/if}
  </div>

  <!-- Jump to present banner (Discord style, bottom positioned) -->
  {#if showScrollBanner}
    <div
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
      class="absolute bottom-4 left-1/2 z-50 flex min-w-fit max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-white/5 bg-secondary px-3 py-2 text-white shadow-xl md:gap-3 md:px-4 md:py-2.5"
    >
      <span class="whitespace-nowrap text-xs font-medium md:text-sm">You're viewing old logs</span>
      <button
        onclick={scrollToBottom}
        class="whitespace-nowrap rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 md:px-4 md:text-sm"
      >
        Jump To Present
      </button>
    </div>
  {/if}

  {#if showScoreboard}
    <!-- Scoreboard Dialog -->
    <Scoreboard
      bind:this={scoreboardRef}
      entries={scoreboardEntries}
      currentPlayer={appState.currentPlayer}
      playerKills={sessionStats.playerKills}
      aiKills={sessionStats.aiKills}
      playerShipsDestroyed={sessionStats.playerShipsDestroyed}
      aiShipsDestroyed={sessionStats.aiShipsDestroyed}
      deaths={sessionStats.deaths}
      currentUserId={appState.user?.discordId}
      currentUserDiscordId={appState.user?.discordId}
      currentUserAvatar={appState.user?.avatar ?? undefined}
    />
  {/if}

  <!-- Player Name Update Loading Overlay -->
  {#if appState.isPlayerNameUpdating}
    <div class="absolute inset-0 z-10 flex items-center justify-center bg-primary/80 backdrop-blur-sm">
      <div class="flex flex-col items-center gap-3 rounded-lg bg-panel p-6 shadow-xl border border-white/5">
        <Loader2 class="h-8 w-8 animate-spin text-accent" />
        <div class="text-center">
          <p class="text-white font-medium">Switching Character</p>
          <p class="text-white/60 text-sm mt-1">Updating profile and refreshing data...</p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Nested View Transition Groups - Container */
  :global(.log-feed-container) {
    view-transition-name: log-feed-container;
    /* view-transition-group: contain; */ /* Unknown CSS property, commented out to suppress warning */
  }

  :global(::view-transition-group-children(log-feed-container)) {
    overflow: clip;
  }
</style>
