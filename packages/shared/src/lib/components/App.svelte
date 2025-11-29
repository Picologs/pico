<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import Header from './Header.svelte';
  import DashboardPage from './DashboardPage.svelte';
  import Toast from './Toast.svelte';
  import GettingStartedDialog from './GettingStartedDialog.svelte';
  import { appState, hasMembers } from "../app.svelte.js";
  import type { GroupMember, DashboardDataResponse, FriendRequest } from "@pico/types";
  import type { FleetDatabase } from '../utils/ship-utils.js';

  // Props
  interface Props {
    wsUrl: string;
    userId: string;
    token: string;
    uploadUrl?: string;
    uploadFetchFn?: typeof fetch;
    fleet?: FleetDatabase;
    children?: Snippet;
    onClearLogs?: () => void;
    hideHeader?: boolean;
    hideToast?: boolean;
    downloadUrl?: string;
  }

  let { wsUrl, userId, token, uploadUrl = 'http://localhost:8080', uploadFetchFn = fetch, fleet = undefined, children, onClearLogs, hideHeader = false, hideToast = false, downloadUrl }: Props = $props();

  // Check if props are valid
  if (!userId || userId.trim() === '') {
    console.error('[App.svelte] ERROR: userId prop is empty or invalid');
  }

  if (!token || token.trim() === '') {
    console.error('[App.svelte] ERROR: token prop is empty or invalid');
  }

  // WebSocket state
  let ws = $state<WebSocket | null>(null);
  let connectionStatus = $state<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting");

  // Reconnection state
  let reconnectAttempts = $state(0);
  let reconnectTimeout: ReturnType<typeof setTimeout> | undefined = $state();
  let isIntentionalDisconnect = false;
  const maxReconnectAttempts = 10;

  // Pending requests (for request-response pattern)
  let pendingRequests = new Map<
    string,
    {
      resolve: Function;
      reject: Function;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  // Track inflight group member fetches to prevent duplicates
  const inflightGroupFetches = new Set<string>();

  // Getting Started dialog state
  let showGettingStartedDialog = $state(false);

  // Check if user needs to see the Getting Started dialog
  $effect(() => {
    // Only show for authenticated users without a playername
    // AND not currently updating player name (prevents flashing during updates)
    if (appState.user && !appState.user.player && !appState.isPlayerNameUpdating) {
      showGettingStartedDialog = true;
    } else {
      showGettingStartedDialog = false;
    }
  });

  /**
   * Decompress gzip-compressed base64-encoded logs using native browser API
   * @param base64Data - Base64-encoded gzip data from server
   * @returns Decompressed logs array
   */
  async function decompressLogs(base64Data: string): Promise<any[]> {
    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress using native DecompressionStream API
    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const decompressedBlob = await new Response(decompressedStream).blob();
    const text = await decompressedBlob.text();

    return JSON.parse(text);
  }

  // Register fetchGroupMembers callback in appState
  appState.fetchGroupMembers = fetchGroupMembers;

  // Register sendRequest callbacks in appState
  appState.sendRequest = sendRequest;
  appState.sendRequestWithRetry = sendRequestWithRetry;

  // Store JWT token, upload URL, and fetch function in appState for authenticated API calls
  appState.token = token;
  appState.uploadUrl = uploadUrl;
  appState.uploadFetchFn = uploadFetchFn;

  // Sync connection status to appState for desktop/website components
  $effect(() => {
    appState.connectionStatus = connectionStatus;
  });

  // Initial WebSocket connection (runs once on mount)
  onMount(() => {
    // Initialize appState effects (must be called from component context)
    appState.initializeEffects();

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      isIntentionalDisconnect = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);

      // Clear all pending requests to prevent memory leaks
      for (const [_, pending] of pendingRequests) {
        clearTimeout(pending.timeout);
      }
      pendingRequests.clear();

      ws?.close();
    };
  });

  // Page Visibility API - Auto-reconnect when user returns from AFK
  $effect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        connectionStatus === "disconnected" &&
        !isIntentionalDisconnect
      ) {
        // Reset exponential backoff when user returns
        reconnectAttempts = 0;
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        attemptReconnect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup function (Svelte 5 pattern)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  });

  /**
   * Attempt to reconnect with exponential backoff
   */
  function attemptReconnect(): void {
    if (isIntentionalDisconnect || reconnectAttempts >= maxReconnectAttempts) {
      return;
    }

    // Exponential backoff with jitter (best practice 2025)
    const baseDelay = 1000 * Math.pow(2, reconnectAttempts);
    const cappedDelay = Math.min(baseDelay, 30000); // Max 30s
    const jitter = cappedDelay * 0.25 * (Math.random() - 0.5);
    const delayMs = Math.max(100, cappedDelay + jitter);

    reconnectAttempts++;

    reconnectTimeout = setTimeout(() => {
      connectWebSocket();
    }, delayMs);
  }

  /**
   * Connect or reconnect to WebSocket
   */
  function connectWebSocket(): void {
    // Validate parameters before connecting
    if (!userId || userId.trim() === '') {
      console.error('[App.svelte] WebSocket connection failed: userId is empty');
      connectionStatus = "error";
      appState.setConnectionStatus("disconnected");
      appState.addToast('Connection failed: Invalid user session. Please sign in again.', 'error');
      return;
    }

    if (!token || token.trim() === '') {
      console.error('[App.svelte] WebSocket connection failed: token is empty');
      connectionStatus = "error";
      appState.setConnectionStatus("disconnected");
      appState.addToast('Connection failed: Invalid authentication. Please sign in again.', 'error');
      return;
    }

    connectionStatus = "connecting";
    appState.setConnectionStatus("connecting");
    ws = new WebSocket(wsUrl);

    ws.onopen = async () => {
      connectionStatus = "connected";
      appState.setConnectionStatus("connected");
      reconnectAttempts = 0; // Reset on successful connection

      // Send registration message
      const registerMsg = {
        type: "register",
        userId: userId,
        token: token,
        clientType: "website",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      ws?.send(JSON.stringify(registerMsg));
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle request-response pattern
        if (data.requestId && pendingRequests.has(data.requestId)) {
          const pending = pendingRequests.get(data.requestId);
          if (pending) {
            clearTimeout(pending.timeout);
            if (data.error) {
              pending.reject(new Error(data.error));
            } else {
              pending.resolve(data.data);
            }
            pendingRequests.delete(data.requestId);
          }
          return;
        }


        // Fallback: Handle responses without requestId (bun-server doesn't echo it back)
        // Match by message type to pending request type
        if (data.type === "group_members_list") {
          // Find pending request for get_group_members
          for (const [requestId, pending] of pendingRequests.entries()) {
            if (requestId.startsWith("get_group_members-")) {
              clearTimeout(pending.timeout);
              if (data.error) {
                pending.reject(new Error(data.error));
              } else {
                pending.resolve(data.data);
              }
              pendingRequests.delete(requestId);
              return;
            }
          }
        }

        if (data.type === "friend_requests") {
          // Find pending request for get_friend_requests
          for (const [requestId, pending] of pendingRequests.entries()) {
            if (requestId.startsWith("get_friend_requests-")) {
              clearTimeout(pending.timeout);
              if (data.error) {
                pending.reject(new Error(data.error));
              } else {
                pending.resolve(data.data || data);
              }
              pendingRequests.delete(requestId);
              return;
            }
          }
        }

        if (data.type === "friends_list") {
          // Find pending request for get_friends
          for (const [requestId, pending] of pendingRequests.entries()) {
            if (requestId.startsWith("get_friends-")) {
              clearTimeout(pending.timeout);
              if (data.error) {
                pending.reject(new Error(data.error));
              } else {
                pending.resolve(data.data || data);
              }
              pendingRequests.delete(requestId);
              return;
            }
          }
        }


        if (data.type === "logs_sent") {
          // Find pending request for batch_logs
          for (const [requestId, pending] of pendingRequests.entries()) {
            if (requestId.startsWith("batch_logs-")) {
              clearTimeout(pending.timeout);
              if (data.error) {
                pending.reject(new Error(data.error));
              } else {
                pending.resolve(data.data || data);
              }
              pendingRequests.delete(requestId);
              return;
            }
          }
        }

        if (data.type === "dashboard_data") {
          // Find pending request for get_dashboard_data
          for (const [requestId, pending] of pendingRequests.entries()) {
            if (requestId.startsWith("get_dashboard_data-")) {
              clearTimeout(pending.timeout);
              if (data.error) {
                pending.reject(new Error(data.error));
              } else {
                pending.resolve(data.data || data);
              }
              pendingRequests.delete(requestId);
              return;
            }
          }
        }

        // Route messages to appState updates
        switch (data.type) {
          case "registered":
            // Auto-load dashboard data after successful registration
            // Single optimized call instead of 3 sequential requests
            sendRequest<DashboardDataResponse['data']>("get_dashboard_data", {
              friendsPage: 1,
              friendsPerPage: 50,
              includeGroupMembers: false
            })
              .then((data) => {

                // ===== FRIENDS =====
                const incomingFriends = data.friends || [];
                const currentFriendsCount = appState.friends.length;

                // Smart merge: preserve paginated data if we have more cached
                if (currentFriendsCount > incomingFriends.length && incomingFriends.length > 0) {
                  const friendsMap = new Map(appState.friends.map(f => [f.friendDiscordId, f]));
                  incomingFriends.forEach(newFriend => {
                    const existing = friendsMap.get(newFriend.friendDiscordId);
                    friendsMap.set(newFriend.friendDiscordId, {
                      ...newFriend,
                      isOnline: existing?.isOnline ?? newFriend.isOnline,
                      isConnected: existing?.isConnected ?? newFriend.isConnected
                    });
                  });
                  appState.friends = Array.from(friendsMap.values());
                } else if (incomingFriends.length > 0) {
                  appState.setFriends(incomingFriends);
                }
                // If incoming is empty but we have friends, keep existing (no overwrite)

                // Update pagination metadata
                if (data.friendsPagination) {
                  appState.friendsPagination.currentPage = data.friendsPagination.page || 1;
                  appState.friendsPagination.hasMore = data.friendsPagination.hasMore ?? false;
                } else {
                  appState.friendsPagination.currentPage = 1;
                }

                // ===== FRIEND REQUESTS =====
                // Friend requests are fetched separately via get_friend_requests
                // Dashboard data no longer includes friend requests

                // ===== GROUPS =====
                appState.setGroups(data.groups || []);

                // ===== PENDING JOIN REQUESTS =====
                // Populate pendingJoinRequests Map for notification dropdown
                if (data.pendingJoinRequests) {
                  for (const [groupId, requests] of Object.entries(data.pendingJoinRequests)) {
                    appState.pendingJoinRequests.set(groupId, requests as import('@pico/types').GroupJoinRequest[]);
                  }
                }

                // Auto-fetch members if there's an active group that needs them
                // This handles the case where activeGroupId was restored from localStorage
                // before dashboard data loaded, and the $effect didn't trigger yet
                const activeGroupId = appState.activeGroupId;
                if (activeGroupId) {
                  const activeGroup = (data.groups || []).find(g => g.id === activeGroupId) as any;
                  if (activeGroup && (!activeGroup.members || activeGroup.members.length === 0)) {
                    fetchGroupMembers(activeGroupId);
                  }
                }

                // Note: Group members are also auto-fetched by the $effect in app.svelte.ts
                // when activeGroupId is set and group needs members (handles manual selection)
              })
              .catch((error) => {
                console.error("[App.svelte] Failed to load dashboard data:", error);
                console.error("[App.svelte] Falling back to individual requests");

                // Track fallback failures
                let fallbacksFailed = 0;
                const totalFallbacks = 2;

                const checkAllFailed = () => {
                  fallbacksFailed++;
                  if (fallbacksFailed >= totalFallbacks) {
                    appState.addToast('Failed to load data. Please refresh the page.', 'error');
                  }
                };

                // Fallback: load data individually if dashboard_data fails
                sendRequest<{ friends: any[] }>("get_friends", { page: 1 })
                  .then((response) => {
                    const incomingFriends = response.friends || [];
                    if (incomingFriends.length > 0) {
                      appState.setFriends(incomingFriends);
                    }
                    appState.friendsPagination.currentPage = 1;
                  })
                  .catch((err) => {
                    console.error("[App.svelte] Fallback: Failed to load friends:", err);
                    checkAllFailed();
                  });

                sendRequest<{ incoming: any[]; outgoing: any[] }>("get_friend_requests")
                  .then((response) => {
                    appState.setFriendRequests({
                      incoming: response.incoming || [],
                      outgoing: response.outgoing || [],
                    });
                  })
                  .catch((err) => {
                    console.error("[App.svelte] Fallback: Failed to load friend requests:", err);
                    checkAllFailed();
                  });

              });
            break;

          case "user_came_online":
            if (data.data?.discordId) {
              appState.updateFriendOnlineStatus(data.data.discordId, true);
            }
            break;

          case "user_disconnected":
            if (data.data?.discordId) {
              appState.updateFriendOnlineStatus(data.data.discordId, false);
            }
            break;

          case "friend_profile_updated":
            if (data.data) {
              const friendIndex = appState.friends.findIndex(
                f => f.friendDiscordId === data.data.discordId
              );

              if (friendIndex !== -1) {
                appState.friends[friendIndex] = {
                  ...appState.friends[friendIndex],
                  friendPlayer: data.data.player,
                  friendDisplayName: data.data.displayName,
                  friendUsePlayerAsDisplayName: data.data.usePlayerAsDisplayName,
                  friendAvatar: data.data.avatar
                };
              }

              // Refresh group members if they're in any shared groups
              for (const group of appState.groups) {
                if (group.members?.some(m => m.discordId === data.data.discordId)) {
                  fetchGroupMembers(group.id, true);
                }
              }
            }
            break;

          case "log":
            if (data.data?.log) {
              appState.addLog(data.data.log);
            }
            break;

          case "batch_logs":
            if (data.data?.logs && Array.isArray(data.data.logs)) {
              appState.addLogs(data.data.logs);
            }
            break;

          case "group_log":
            if (data.data?.log) {
              appState.addLog(data.data.log);
            }
            break;

          case "logs_received":
            // Handle friend logs from another user
            if (data.data?.compressed && data.data?.compressedData) {
              try {
                const decompressed = await decompressLogs(data.data.compressedData);
                // Persist to friend storage if we know the sender
                const senderId = data.data?.senderId || decompressed[0]?.userId;
                if (senderId && senderId !== userId) {
                  appState.addFriendLogs(senderId, decompressed);
                } else {
                  appState.addLogs(decompressed);
                }
              } catch (error) {
                console.error('[App.svelte] Failed to decompress logs:', error);
              }
            } else if (data.data?.logs && Array.isArray(data.data.logs)) {
              const senderId = data.data?.senderId || data.data.logs[0]?.userId;
              if (senderId && senderId !== userId) {
                appState.addFriendLogs(senderId, data.data.logs);
              } else {
                appState.addLogs(data.data.logs);
              }
            }
            break;

          case "log_received":
            // Handle single log from friend
            if (data.data?.compressed && data.data?.compressedData) {
              try {
                const decompressed = await decompressLogs(data.data.compressedData);
                const senderId = data.data?.senderId || decompressed[0]?.userId;
                if (senderId && senderId !== userId) {
                  appState.addFriendLogs(senderId, decompressed);
                } else {
                  appState.addLogs(decompressed);
                }
              } catch (error) {
                console.error('[App.svelte] Failed to decompress log:', error);
              }
            } else if (data.data?.logs && Array.isArray(data.data.logs)) {
              const senderId = data.data?.senderId || data.data.logs[0]?.userId;
              if (senderId && senderId !== userId) {
                appState.addFriendLogs(senderId, data.data.logs);
              } else {
                appState.addLogs(data.data.logs);
              }
            }
            break;

          case "batch_logs_received":
            // Handle batch logs from friend
            if (data.data?.compressed && data.data?.compressedData) {
              try {
                const decompressed = await decompressLogs(data.data.compressedData);
                const senderId = data.data?.senderId || decompressed[0]?.userId;
                if (senderId && senderId !== userId) {
                  appState.addFriendLogs(senderId, decompressed);
                } else {
                  appState.addLogs(decompressed);
                }
              } catch (error) {
                console.error('[App.svelte] Failed to decompress batch logs:', error);
              }
            } else if (data.data?.logs && Array.isArray(data.data.logs)) {
              const senderId = data.data?.senderId || data.data.logs[0]?.userId;
              if (senderId && senderId !== userId) {
                appState.addFriendLogs(senderId, data.data.logs);
              } else {
                appState.addLogs(data.data.logs);
              }
            }
            break;

          case "group_logs_received":
            // Handle group logs from another user
            if (data.data?.compressed && data.data?.compressedData) {
              try {
                const decompressed = await decompressLogs(data.data.compressedData);
                const groupId = data.data?.groupId;
                if (groupId) {
                  appState.addGroupLogs(groupId, decompressed);
                } else {
                  appState.addLogs(decompressed);
                }
              } catch (error) {
                console.error('[App.svelte] Failed to decompress group logs:', error);
              }
            } else if (data.data?.logs && Array.isArray(data.data.logs)) {
              const groupId = data.data?.groupId;
              if (groupId) {
                appState.addGroupLogs(groupId, data.data.logs);
              } else {
                appState.addLogs(data.data.logs);
              }
            }
            break;

          case "user_profile_updated":
            if (data.data) {
              const oldUser = appState.user;
              // Merge updates to preserve fields not in broadcast (like avatar)
              appState.mergeUser(data.data);

              // If display preferences changed for current user, refresh affected groups
              const isCurrentUser = data.data.discordId === userId;
              const displayChanged =
                data.data.player !== oldUser?.player ||
                data.data.usePlayerAsDisplayName !== oldUser?.usePlayerAsDisplayName;

              if (isCurrentUser && displayChanged) {
                // Current user's profile changed - refresh all their groups
                for (const group of appState.groups) {
                  if (group.members?.some(m => m.discordId === data.data.discordId)) {
                    // Clear cache for this group
                    if (typeof window !== 'undefined') {
                      const cacheKey = `picologs:groupMembers:${group.id}`;
                      localStorage.removeItem(cacheKey);
                    }

                    // Refresh members from server
                    fetchGroupMembers(group.id, true).catch(error => {
                      console.error('[App.svelte] Failed to refresh group members after profile update:', error);
                    });
                  }
                }
              }
            }
            break;

          case "refetch_friends":
            sendRequest<{ friends: any[] }>("get_friends", { page: 1 })
              .then((response) => {
                const incomingFriends = response.friends || [];
                const currentFriendsCount = appState.friends.length;

                // Smart merge: preserve paginated data if we have more cached
                if (currentFriendsCount > incomingFriends.length && incomingFriends.length > 0) {
                  const friendsMap = new Map(appState.friends.map(f => [f.friendDiscordId, f]));
                  incomingFriends.forEach(newFriend => {
                    const existing = friendsMap.get(newFriend.friendDiscordId);
                    friendsMap.set(newFriend.friendDiscordId, {
                      ...newFriend,
                      isOnline: existing?.isOnline ?? newFriend.isOnline,
                      isConnected: existing?.isConnected ?? newFriend.isConnected
                    });
                  });
                  appState.friends = Array.from(friendsMap.values());
                } else if (incomingFriends.length > 0) {
                  appState.setFriends(incomingFriends);
                }

                appState.friendsPagination.currentPage = 1;
              })
              .catch((error) => {
                console.error("[App.svelte] Failed to reload friends:", error);
              });
            break;


          case "refetch_friend_requests":
            sendRequest<{ incoming: any[]; outgoing: any[] }>(
              "get_friend_requests",
            )
              .then((response) => {
                // Merge with existing requests to prevent race condition where broadcast-added
                // requests are overwritten by API response
                const existingIncoming = appState.friendRequests.incoming;
                const existingOutgoing = appState.friendRequests.outgoing;

                // Deduplicate by friendship ID
                const incomingMap = new Map([...existingIncoming, ...(response.incoming || [])].map(r => [r.id, r]));
                const outgoingMap = new Map([...existingOutgoing, ...(response.outgoing || [])].map(r => [r.id, r]));

                appState.setFriendRequests({
                  incoming: Array.from(incomingMap.values()),
                  outgoing: Array.from(outgoingMap.values()),
                });
              })
              .catch((error) => {
                console.error("[App.svelte] Failed to reload friend requests:", error);
              });
            break;

          case "refetch_group_invitations":
            // TODO: Reload group invitations - needs API call or server to send data
            break;

          case "group_invitation_accepted":
            // NOTE: Request-response messages (with requestId) are handled in acceptGroupInvitation
            // This handler is for potential broadcast messages only
            if (data.data && data.data.group && !data.requestId) {
              const { group } = data.data;

              // Add the group to the side panel (only for broadcasts)
              appState.addGroup(group);

              console.log("[App.svelte] Added group from broadcast:", group.name);
            }
            break;

          case "member_joined_group":
            if (data.data) {
              const { groupId, groupName, memberDisplayName } = data.data;

              // Show toast notification
              appState.addToast(
                `${memberDisplayName} joined ${groupName}`,
                "info",
              );

              // Update group member count
              const group = appState.groups.find((g) => g.id === groupId);
              if (group) {
                appState.updateGroup(groupId, {
                  ...group,
                  memberCount: group.memberCount + 1,
                });

                // Force refresh members to show new member
                fetchGroupMembers(groupId, true).catch((error) => {
                  console.error("[App.svelte] Failed to refresh group members:", error);
                });
              }
            }
            break;

          case "member_left_group":
          case "member_removed_from_group":
            if (data.data) {
              const { groupId, userId, username } = data.data;
              const displayName = username || "A member";

              // Show toast notification
              const action = data.type === "member_left_group" ? "left" : "was removed from";
              const group = appState.groups.find((g) => g.id === groupId);
              if (group) {
                appState.addToast(
                  `${displayName} ${action} ${group.name}`,
                  "info",
                );

                // Update group member count
                appState.updateGroup(groupId, {
                  ...group,
                  memberCount: Math.max(0, group.memberCount - 1),
                });

                // Force refresh members to reflect removal
                fetchGroupMembers(groupId, true).catch((error) => {
                  console.error("[App.svelte] Failed to refresh group members:", error);
                });
              }
            }
            break;

          case "member_role_updated":
            if (data.data) {
              const { groupId, memberId, role } = data.data;

              // Show toast notification
              const group = appState.groups.find((g) => g.id === groupId);
              if (group) {
                appState.addToast(
                  `Member role updated to ${role} in ${group.name}`,
                  "info",
                );

                // Force refresh members to reflect role change
                fetchGroupMembers(groupId, true).catch((error) => {
                  console.error("[App.svelte] Failed to refresh group members:", error);
                });
              }
            }
            break;

          case "group_updated":
            if (data.data) {
              const { groupId, group: updatedGroup } = data.data;

              // Update group in appState
              if (updatedGroup) {
                appState.updateGroup(groupId, updatedGroup);
              }
            }
            break;

          case "group_deleted":
            if (data.data) {
              const { groupId } = data.data;
              const deletedGroup = appState.groups.find((g) => g.id === groupId);

              // Remove group from local state
              appState.removeGroup(groupId);

              // Clear active group if it was deleted
              if (appState.activeGroupId === groupId) {
                appState.setActiveGroupId(null);
              }

              // Show toast notification
              if (deletedGroup) {
                appState.addToast(`Group "${deletedGroup.name}" was deleted`, "info");
              }
            }
            break;

          case "friend_request_received":
            if (data.data) {
              // Add to incoming requests
              const request = {
                id: data.data.id,
                status: "pending",
                createdAt: data.data.createdAt,
                fromUserId: data.data.fromUserId,
                fromDiscordId: data.data.fromDiscordId,
                fromUsername: data.data.fromUsername,
                fromDisplayName: data.data.fromDisplayName,
                fromAvatar: data.data.fromAvatar,
                fromPlayer: data.data.fromPlayer || null,
                fromTimeZone: null,
                fromUsePlayerAsDisplayName: false,
                direction: "incoming" as const,
              };

              appState.addFriendRequest(request);
              appState.addToast(
                `${data.data.fromDisplayName} sent you a friend request`,
                "info",
              );
            }
            break;

          case "group_invitation_received":
            if (data.data) {
              const { id, groupId, groupName, groupAvatar, inviterDiscordId, inviterUsername, inviterDisplayName, createdAt } = data.data;

              // Create notification data
              const notificationData: any = {
                type: 'group_invitation',
                invitationId: id,
                groupId,
                groupName,
                groupAvatar,
                inviterId: inviterDiscordId,
                inviterUsername,
                inviterDisplayName,
                inviterAvatar: null
              };

              // Add to notifications in appState
              appState.addNotification({
                id: crypto.randomUUID(),
                userId: userId,
                type: 'group_invitation',
                title: 'Group Invitation',
                message: `${inviterDisplayName} invited you to join ${groupName}`,
                data: notificationData,
                read: false,
                readAt: null,
                createdAt
              });

              // Show toast
              appState.addToast(
                `${inviterDisplayName} invited you to join ${groupName}`,
                "info",
              );
            }
            break;

          case "friend_request_accepted_notification":
            if (data.data) {
              // Remove from outgoing requests
              // Note: For outgoing requests, we sent TO someone, so we need to match against the recipient
              // The notification data.data contains friendDiscordId (the person who accepted)
              const requestToRemove = appState.friendRequests.outgoing.find(
                (req) => req.fromDiscordId === data.data.friendDiscordId,
              );
              if (requestToRemove) {
                appState.removeFriendRequest(requestToRemove.id);
              }

              // Add to friends list
              const newFriend = {
                id: data.data.id,
                status: data.data.status || "accepted",
                createdAt: data.data.createdAt || new Date().toISOString(),
                friendUserId: data.data.friendUserId,
                friendDiscordId: data.data.friendDiscordId,
                friendUsername: data.data.friendUsername,
                friendDisplayName: data.data.friendDisplayName,
                friendAvatar: data.data.friendAvatar,
                friendPlayer: data.data.friendPlayer || null,
                friendTimeZone: data.data.friendTimeZone || null,
                friendUsePlayerAsDisplayName:
                  data.data.friendUsePlayerAsDisplayName || false,
                isOnline: data.data.isOnline || false,
              };

              appState.addFriend(newFriend);
              appState.addToast(
                `${data.data.friendDisplayName} accepted your friend request!`,
                "success",
              );
            }
            break;

          case "friend_removed_notification":
            if (data.data) {
              // Find and remove the friend by their Discord ID
              const friendToRemove = appState.friends.find(
                (friend) =>
                  friend.friendDiscordId === data.data.removedByDiscordId,
              );
              if (friendToRemove) {
                appState.removeFriend(friendToRemove.id);
                appState.addToast(
                  `${data.data.removedByDisplayName || data.data.removedByUsername} removed you as a friend`,
                  "info",
                );
              }
            }
            break;

          case "new_join_request":
            // Real-time notification when someone requests to join a group you own/admin
            if (data.data) {
              const joinRequest = data.data as import('@pico/types').GroupJoinRequest;
              const existingRequests = appState.pendingJoinRequests.get(joinRequest.groupId) || [];
              // Avoid duplicates
              if (!existingRequests.some(r => r.id === joinRequest.id)) {
                appState.pendingJoinRequests.set(joinRequest.groupId, [...existingRequests, joinRequest]);
                // Also increment the group's pendingJoinRequestCount for UI display
                const groupIndex = appState.groups.findIndex(g => g.id === joinRequest.groupId);
                if (groupIndex !== -1) {
                  const group = appState.groups[groupIndex];
                  appState.groups[groupIndex] = {
                    ...group,
                    pendingJoinRequestCount: (group.pendingJoinRequestCount ?? 0) + 1
                  };
                }
              }
              appState.addToast(
                `${joinRequest.displayName} wants to join ${joinRequest.groupName}`,
                "info",
              );
            }
            break;

          case "join_request_reviewed":
            // Notification when your join request is approved/denied
            if (data.data) {
              const { groupName, decision, group } = data.data;
              if (decision === 'approve' && group) {
                // Add the group to user's groups
                appState.groups = [...appState.groups, group];
                appState.addToast(
                  `You've been accepted to ${groupName}!`,
                  "success",
                );
              } else {
                appState.addToast(
                  `Your request to join ${groupName} was declined`,
                  "info",
                );
              }
            }
            break;
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      connectionStatus = "error";
      appState.setConnectionStatus("disconnected");
      console.error("[App.svelte] WebSocket error:", error);
    };

    ws.onclose = (event) => {
      connectionStatus = "disconnected";
      appState.setConnectionStatus("disconnected");

      // Don't reconnect on auth failures (1008 = Policy Violation, 1011 = Internal Error)
      if (!isIntentionalDisconnect && event.code !== 1008 && event.code !== 1011) {
        attemptReconnect();
      } else if (event.code === 1008) {
        console.error('[App.svelte] Authentication failed:', event.reason);
        appState.addToast('Authentication failed. Please sign in again.', 'error');
      }
    };
  }

  // Type-specific default timeouts for different operations
  const REQUEST_TIMEOUTS: Record<string, number> = {
    'batch_logs': 30000,           // 30s for batch operations
    'batch_group_logs': 30000,     // 30s for batch operations
    'report_log_patterns': 30000,  // 30s for batch pattern processing
    'get_dashboard_data': 15000,   // 15s for dashboard data
    'get_group_members': 15000,    // 15s for member lists
    'get_friends': 10000,          // 10s for simple queries
    'get_friend_requests': 10000,  // 10s for simple queries
    'get_groups': 10000,           // 10s for simple queries
  };

  // Helper function to send WebSocket requests and wait for responses
  function sendRequest<T>(
    type: string,
    data?: any,
    timeout?: number,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const requestId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const finalTimeout = timeout ?? REQUEST_TIMEOUTS[type] ?? 10000;

      const timeoutId = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${type}`));
      }, finalTimeout);

      pendingRequests.set(requestId, { resolve, reject, timeout: timeoutId });

      const message = {
        type,
        requestId,
        data: data || {},
      };

      ws.send(JSON.stringify(message));
    });
  }

  // Helper to send request with retry and exponential backoff
  async function sendRequestWithRetry<T>(
    type: string,
    data?: any,
    maxRetries = 3,
    timeout?: number,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await sendRequest<T>(type, data, timeout);
      } catch (error) {
        lastError = error as Error;

        // Don't retry if WebSocket is disconnected
        if (lastError.message === "WebSocket not connected") {
          throw lastError;
        }

        // Retry with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          console.log(`[App.svelte] Retrying ${type} in ${delay}ms (attempt ${attempt + 2}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // Cache constants and interface for group members localStorage
  const GROUP_MEMBERS_CACHE_PREFIX = "picologs:groupMembers:";
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  interface CachedGroupMembers {
    members: GroupMember[];
    cachedAt: number;
  }

  /**
   * Get cached group members from localStorage
   * Returns null if no cache exists or cache is expired
   */
  function getCachedMembers(groupId: string): GroupMember[] | null {
    // Check if running in browser (SSR safety)
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const key = `${GROUP_MEMBERS_CACHE_PREFIX}${groupId}`;
      const cached = localStorage.getItem(key);
      if (!cached) {
        return null;
      }

      const data: CachedGroupMembers = JSON.parse(cached);
      const age = Date.now() - data.cachedAt;

      // Check if expired
      if (age > CACHE_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }

      return data.members;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save group members to localStorage cache
   */
  function setCachedMembers(groupId: string, members: GroupMember[]): void {
    // Check if running in browser (SSR safety)
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const key = `${GROUP_MEMBERS_CACHE_PREFIX}${groupId}`;
      const data: CachedGroupMembers = {
        members,
        cachedAt: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      // Silent failure for cache writes
    }
  }

  /**
   * Fetch group members for a specific group
   * Exported to be called by child components
   * @param forceRefresh - If true, fetch members even if already loaded
   */
  export async function fetchGroupMembers(groupId: string, forceRefresh = false): Promise<void> {
    // Deduplicate concurrent fetches for the same group
    if (inflightGroupFetches.has(groupId)) {
      return; // Already fetching this group, skip
    }

    try {
      inflightGroupFetches.add(groupId);

      // Check if members already loaded in state (skip if force refresh)
      let group = appState.groups.find((g) => g.id === groupId);
      const hasMembersLoaded = group && hasMembers(group);

      if (!forceRefresh && hasMembersLoaded) {
        return; // Already have members, no need to fetch
      }

      // Try cache first for instant display (unless forced refresh)
      if (!forceRefresh) {
        const cachedMembers = getCachedMembers(groupId);
        if (cachedMembers && cachedMembers.length > 0) {
          // Instantly update UI with cached data
          appState.updateGroup(groupId, { members: cachedMembers } as any);
        }
      }

      // Fetch from network
      const apiMembers = await sendRequest<any[]>("get_group_members", {
        groupId,
      });

      // Transform API members to UI format and limit to first 10
      // Note: Server returns { members: [...] }, not array directly
      const transformedMembers: GroupMember[] = ((apiMembers as any)?.members || [])
        .slice(0, 10)
        .map((m: any) => ({
          ...m,
          isOnline: m.isOnline || false,
          isConnected: m.isConnected || false,
        }));

      // Update appState
      appState.updateGroup(groupId, { members: transformedMembers } as any);

      // Save to cache for next time
      setCachedMembers(groupId, transformedMembers);
    } catch (error) {
      console.error("[App.svelte] Failed to fetch group members:", error);
      throw error;
    } finally {
      inflightGroupFetches.delete(groupId);
    }
  }
</script>


<div class="flex h-dvh flex-col bg-primary">
  {#if !hideHeader}
    <Header {onClearLogs} />
  {/if}
  <div class="flex-1 overflow-hidden">
    {#if children}
      {@render children()}
    {:else}
      <DashboardPage {fleet} />
    {/if}
  </div>
</div>
{#if !hideToast}
  <Toast notifications={appState.toasts} onRemove={appState.removeToast.bind(appState)} />
{/if}

<!-- Getting Started dialog for users without playername (website only) -->
{#if !appState.isDesktop}
	<GettingStartedDialog bind:open={showGettingStartedDialog} {downloadUrl} />
{/if}
