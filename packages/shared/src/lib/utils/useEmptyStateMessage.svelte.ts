/**
 * Composable for context-aware empty state messages
 *
 * Generates appropriate empty state messages based on active filters:
 * - Friend filter: "{Friend Name} has no logs yet"
 * - Group filter: "{Group Name} has no logs yet"
 * - No filter: Platform-specific or default message
 *
 * @example
 * ```typescript
 * // Desktop usage (with offline mode)
 * const emptyMessage = useEmptyStateMessage({
 *   isOffline: !isWatchingLogs,
 *   offlineMessage: 'Select your Star Citizen Game.log file to get started'
 * });
 *
 * // Website usage (no platform options)
 * const emptyMessage = useEmptyStateMessage();
 * ```
 */

import { appState } from "../app.svelte.js";
import { getDisplayName } from "./display-name.js";

export interface EmptyStateMessageOptions {
  /**
   * Whether the platform is in offline mode (desktop-specific)
   */
  isOffline?: boolean;

  /**
   * Custom message to show when offline (desktop-specific)
   */
  offlineMessage?: string;

  /**
   * Custom fallback message when no filters are active
   */
  fallbackMessage?: string;
}

/**
 * Generates context-aware empty state message based on active filters
 * Returns a getter function to maintain reactivity when used with $derived
 */
export function useEmptyStateMessage(
  platformOptions?: EmptyStateMessageOptions,
) {
  return () => {
    // Friend filter active - show "{Friend Name} has no logs yet"
    if (appState.activeFriendId) {
      const friend = appState.friends.find(
        (f) => f.friendDiscordId === appState.activeFriendId,
      );

      if (!friend) {
        return "Friend has no logs yet";
      }

      const friendName = getDisplayName({
        username: friend.friendUsername,
        player: friend.friendPlayer,
        usePlayerAsDisplayName: friend.friendUsePlayerAsDisplayName,
      });

      return `${friendName || "Friend"} has no logs yet`;
    }

    // Group filter active - show "{Group Name} has no logs yet"
    if (appState.activeGroupId) {
      const group = appState.groups.find(
        (g) => g.id === appState.activeGroupId,
      );
      const groupName = group?.name || "Group";
      return `${groupName} has no logs yet`;
    }

    // Platform-specific offline mode (desktop only)
    if (platformOptions?.isOffline && platformOptions.offlineMessage) {
      return platformOptions.offlineMessage;
    }

    // Default fallback message
    return (
      platformOptions?.fallbackMessage ||
      "No new logs yet. Waiting for activity..."
    );
  };
}
