<script lang="ts">
  import Resizer from "./Resizer.svelte";
  import SidePanelGroups from "./SidePanelGroups.svelte";
  import Avatar from "./Avatar.svelte";
  import { UserPlus } from "@lucide/svelte";
  import { appState, hasMembers } from "../app.svelte.js";
  import type { GroupItemData } from "./GroupItem.svelte";
  import { SvelteMap, SvelteDate } from "svelte/reactivity";
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { getAvatarUrl } from "../utils/avatarUtils.js";

  interface SelectableFriend {
    id: string;
    discordId: string;
    name: string;
    avatar: string | null;
    isOnline: boolean;
    timezone?: string;
  }

  // Helper to validate member role
  function validateMemberRole(role: string): 'owner' | 'admin' | 'member' {
    const validRoles = ['owner', 'admin', 'member'] as const;
    return validRoles.includes(role as any) ? (role as 'owner' | 'admin' | 'member') : 'member';
  }

  // localStorage keys
  const SELECTED_GROUP_KEY = "picologs_selectedGroupId";
  const SELECTED_FRIEND_KEY = "picologs_selectedFriendId";

  // Reactive time for timezone display updates
  const now = new SvelteDate();
  $effect(() => {
    const interval = setInterval(() => {
      now.setTime(Date.now());
    }, 60000); // Update every 60 seconds
    return () => clearInterval(interval);
  });

  // Transform appState.groups to GroupItemData[] format expected by SidePanelGroups
  let transformedGroups = $derived(
    (Array.isArray(appState.groups) ? appState.groups : []).map((group: any) => ({
      id: group.id,
      name: group.name,
      avatar: group.avatar,
      memberCount: group.memberCount || 0,
      memberRole: validateMemberRole(group.memberRole),
      tags: group.tags || [],
      members: group.members || []
    }))
  ) as GroupItemData[];

  // Transform appState.friendsWithDisplayNames to SelectableFriend[] format
  let transformedFriends = $derived(
    (Array.isArray(appState.friendsWithDisplayNames) ? appState.friendsWithDisplayNames : []).map((friend: any) => ({
      id: friend.friendUserId,
      discordId: friend.friendDiscordId,
      name: friend.friendDisplayName || friend.friendUsername || 'Unknown',
      avatar: friend.friendAvatar,
      isOnline: friend.isOnline || false,
      timezone: friend.friendTimeZone || undefined
    }))
  ) as SelectableFriend[];

  // Sort friends: online first, then alphabetically (with deduplication)
  let sortedFriends = $derived(
    Array.from(
      new SvelteMap(
        [...transformedFriends]
          .filter((f) => f && f.id) // Filter out null/undefined and items without IDs
          .map((f) => [f.id, f]),
      ).values(),
    ).sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.name.localeCompare(b.name);
    }),
  );

  // State for group selection and loading
  let selectedGroupId = $state<string | null>(null);
  let loadingMembers = $state<Set<string>>(new Set());

  // State for friend selection
  let selectedFriendId = $state<string | null>(null);

  // State for quick add friend
  let friendCode = $state("");
  let isSubmitting = $state(false);

  // Restore selected group/friend from localStorage on mount
  onMount(() => {
    if (browser) {
      try {
        const savedGroupId = localStorage.getItem(SELECTED_GROUP_KEY);
        const savedFriendId = localStorage.getItem(SELECTED_FRIEND_KEY);

        // Enforce mutual exclusivity: only restore one filter
        // If both exist (edge case from bug), prioritize friend and clean up group
        if (savedFriendId) {
          selectedFriendId = savedFriendId;
          appState.setActiveFriendId(savedFriendId);
          // Clean up orphaned group selection
          if (savedGroupId) {
            localStorage.removeItem(SELECTED_GROUP_KEY);
          }
        } else if (savedGroupId) {
          selectedGroupId = savedGroupId;
          appState.setActiveGroupId(savedGroupId);
        }
      } catch (error) {
        // Silent fail on localStorage errors
      }
    }
  });

  // Persist selectedGroupId to localStorage (NO state mutations - prevents infinite loop)
  $effect(() => {
    if (browser) {
      try {
        if (selectedGroupId) {
          localStorage.setItem(SELECTED_GROUP_KEY, selectedGroupId);
        } else {
          localStorage.removeItem(SELECTED_GROUP_KEY);
        }
      } catch (error) {
        // Silent fail
      }
    }
  });

  // Persist selectedFriendId to localStorage (separate effect)
  $effect(() => {
    if (browser) {
      try {
        if (selectedFriendId) {
          localStorage.setItem(SELECTED_FRIEND_KEY, selectedFriendId);
        } else {
          localStorage.removeItem(SELECTED_FRIEND_KEY);
        }
      } catch (error) {
        // Silent fail
      }
    }
  });

  // Sync selectedFriendId with appState.activeFriendId (handles external changes)
  $effect(() => {
    // When appState.activeFriendId is cleared externally (e.g., by group selection),
    // update the local UI state to match
    if (appState.activeFriendId === null && selectedFriendId !== null) {
      selectedFriendId = null;
    }
  });

  // Sync selectedGroupId with appState.activeGroupId (handles external changes)
  $effect(() => {
    // When appState.activeGroupId is cleared externally (e.g., by file selection),
    // update the local UI state to match
    if (appState.activeGroupId === null && selectedGroupId !== null) {
      selectedGroupId = null;
    }
  });

  /**
   * Handle friend selection toggle
   */
  function handleSelectFriend(friendId: string) {
    if (selectedFriendId === friendId) {
      // Deselect friend
      selectedFriendId = null;
      appState.setActiveFriendId(null);
      selectedGroupId = null;
      appState.setActiveGroupId(null);

      // Show toast
      appState.addToast('Showing logs from all friends', 'info');

      // Clear from localStorage
      if (browser) {
        try {
          localStorage.removeItem(SELECTED_FRIEND_KEY);
          localStorage.removeItem(SELECTED_GROUP_KEY);
        } catch (error) {
          // Silent fail
        }
      }

      // Refresh logs to show fresh data from all friends
      appState.refreshLogs();
    } else {
      // Select friend
      selectedFriendId = friendId;
      appState.setActiveFriendId(friendId);
      selectedGroupId = null;
      appState.setActiveGroupId(null);

      // Show toast with friend name and avatar
      const friend = transformedFriends.find(f => f.id === friendId);
      if (friend) {
        const avatarUrl = getAvatarUrl(friend.discordId, friend.avatar, 64);
        appState.addToast(`Showing logs from ${friend.name}`, 'info', {
          avatarUrl: avatarUrl || undefined
        });
      }

      // Persist to localStorage
      if (browser) {
        try {
          localStorage.setItem(SELECTED_FRIEND_KEY, friendId);
          localStorage.removeItem(SELECTED_GROUP_KEY);
        } catch (error) {
          // Silent fail
        }
      }

      // Refresh logs to show fresh data for this friend
      appState.refreshLogs();
    }
  }

  /**
   * Fetch group members via callback from appState (set by App.svelte)
   */
  async function handleFetchGroupMembers(groupId: string) {
    // Check if callback is registered in appState
    if (!appState.fetchGroupMembers) {
      return;
    }

    // Check if members already loaded
    const group = appState.groups.find((g) => g.id === groupId);
    if (group && hasMembers(group)) {
      return; // Already loaded
    }

    // Add to loading state
    loadingMembers.add(groupId);
    loadingMembers = new Set(loadingMembers); // Trigger reactivity

    try {
      // Call the callback from appState (set by App.svelte)
      await appState.fetchGroupMembers(groupId);
    } catch (error) {
      console.error(
        `[SidePanel] Failed to fetch members for group ${groupId}:`,
        error,
      );
    } finally {
      // Remove from loading state
      loadingMembers.delete(groupId);
      loadingMembers = new Set(loadingMembers); // Trigger reactivity
    }
  }

  // Get local time for a friend (uses reactive `now` for live updates)
  function getLocalTime(timezone: string | undefined): string {
    if (!timezone) return "";
    try {
      return now.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  // Get city name from timezone
  function getCityFromTimezone(timezone: string | undefined): string {
    if (!timezone) return "";
    const parts = timezone.split("/");
    let location = parts[parts.length - 1];
    if (parts.length > 1 && parts[0] === "Australia") {
      location = parts.join(", ");
    } else if (parts.length > 2) {
      location = parts.slice(-2).join(", ");
    }
    return location.replace(/_/g, " ");
  }

  /**
   * Handle friend request submission
   */
  async function handleSubmit() {
    const code = friendCode.trim().toUpperCase();
    if (!code || isSubmitting) return;

    isSubmitting = true;
    try {
      await appState.sendFriendRequest(code);
      // Success - clear input
      friendCode = "";
    } catch (error) {
      // Error is already shown via toast by appState
      console.error("[SidePanel] Failed to send friend request:", error);
    } finally {
      isSubmitting = false;
    }
  }

  // Bind to the Resizer instance
  let resizerRef: Resizer;

  // Export methods to toggle groups and friends panels
  export function toggleGroups() {
    if (resizerRef) {
      resizerRef.toggleFirstPanel();
    }
  }

  export function toggleFriends() {
    if (resizerRef) {
      resizerRef.toggleSecondPanel();
    }
  }

  export function isGroupsCollapsed(): boolean {
    return resizerRef?.isFirstPanelCollapsed() ?? false;
  }

  export function isFriendsCollapsed(): boolean {
    return resizerRef?.isSecondPanelCollapsed() ?? false;
  }
</script>

<Resizer
  direction="vertical"
  initialFirstSize={50}
  initialSecondSize={50}
  storageKey="sidePanel"
  bind:this={resizerRef}
>
  {#snippet firstPanel()}
    <SidePanelGroups
      groups={transformedGroups}
      bind:selectedGroupId
      {loadingMembers}
      onFetchGroupMembers={handleFetchGroupMembers}
    />
  {/snippet}

  {#snippet secondPanel()}
    <!-- Friends Section -->
    <div class="flex h-full min-w-0 flex-col">
      <!-- Scrollable Friends List -->
      <div class="scrollbar-custom flex-1 overflow-y-auto px-2 pb-4">
        <h4
          class="py-2 text-xs font-medium tracking-wide text-white/60 uppercase"
        >
          Friends ({sortedFriends.length})
        </h4>
        {#if sortedFriends.length > 0}
          <div class="space-y-1">
            {#each sortedFriends as friend (friend.id)}
              <button
                onclick={() => handleSelectFriend(friend.id)}
                class="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/10 {selectedFriendId ===
                friend.id
                  ? 'ring-2 ring-discord'
                  : ''} {!friend.isOnline ? 'opacity-50' : ''}"
              >
                <Avatar
                  avatar={friend.avatar}
                  discordId={friend.discordId}
                  userId={friend.id}
                  alt={friend.name || "User avatar"}
                  size={8}
                  showOnline={true}
                  isOnline={friend.isOnline}
                  discordCdnUrl="https://cdn.discordapp.com"
                />
                <div
                  class="flex min-w-0 flex-1 flex-col items-start overflow-hidden"
                >
                  <span
                    class="max-w-full truncate text-left text-sm font-medium text-white"
                  >
                    {friend.name || "Unknown player"}
                  </span>
                  {#if friend.timezone}
                    <span
                      class="max-w-full truncate text-left text-xs text-white/40"
                      title={friend.timezone}
                    >
                      {getLocalTime(friend.timezone)} · {getCityFromTimezone(
                        friend.timezone,
                      )}
                    </span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {:else}
          <div
            class="flex items-center justify-center py-8 text-sm text-white/40"
          >
            No friends yet
          </div>
        {/if}
      </div>

      <!-- Quick Add Friend (Fixed at Bottom) -->
      <div class="min-w-0 px-2 pt-2 pb-2">
        <div class="flex min-w-0 items-center gap-2">
          <input
            type="text"
            bind:value={friendCode}
            placeholder="Friend Code"
            maxlength="8"
            class="w-full min-w-0 flex-1 rounded-md bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            disabled={isSubmitting}
            onkeydown={(e) => {
              if (e.key === "Enter") {
                handleSubmit();
              }
            }}
          />
          <button
            onclick={handleSubmit}
            disabled={!friendCode.trim() || isSubmitting}
            class="rounded-md bg-white/5 p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            title="Send Friend Request"
          >
            <UserPlus size={16} />
          </button>
        </div>
      </div>
    </div>
  {/snippet}
</Resizer>
