import type {
  UserProfile,
  ProfileUpdateData,
  Friend,
  Log,
  Group,
  GroupMember,
  FriendRequest,
  FriendRequestsResponse,
  GroupInvitation,
  GroupInvitationNotificationData,
  Notification,
  LogEventType,
  DiscoverableGroup,
  GroupJoinRequest,
  PaginationMetadata,
  GroupVisibility,
  GroupJoinMethod,
} from "@pico/types";
import type { ToastNotification } from "./components/Toast.svelte";
import { updateFriendOnlineStatus as updateFriendStatus } from "./utils/composables-utils.js";
import { getDisplayName } from "./utils/display-name.js";
import {
  getAllPlayersFromLogs,
  dedupeAndSortLogs,
  applyMemoryLimit,
  calculateSessionStats,
  calculateScoreboard,
  extractPlayersFromLog,
  type ScoreboardEntry,
} from "./utils/log-utils.js";
import {
  loadLogs,
  saveLogs,
  clearLogs as clearLogStorage,
  loadFriendLogs,
  saveFriendLogs,
  clearFriendLogs,
  loadGroupLogs,
  saveGroupLogs,
  clearGroupLogs,
} from "./utils/log-storage.js";
import { untrack } from "svelte";
import { filterState, ALL_LOG_TYPES } from "./filterState.svelte.js";

// Connection status type
export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error";

// Runtime group type with members array (Group from DB doesn't include members)
type GroupWithMembers = Group & { members?: GroupMember[] };

/**
 * Type guard to check if a group has members loaded
 */
export function hasMembers(
  group: GroupWithMembers,
): group is GroupWithMembers & { members: GroupMember[] } {
  return Array.isArray(group.members) && group.members.length > 0;
}

// Filter state is now in filterState.svelte.ts

/**
 * Check if a log is a navigation/error log that should be deduplicated by ship ID
 * These logs are repetitive system errors that spam the log feed if not filtered
 */
function isNavigationOrErrorLog(log: Log): boolean {
  const line = log.line || log.original || "";

  // Check for navigation errors with "NOT AUTH" indicator and ItemNavigation
  if (line.includes("NOT AUTH") && line.includes("ItemNavigation")) {
    return true;
  }

  // Check for specific navigation error patterns
  if (
    line.includes("Failed to get starmap route data") ||
    line.includes("No Route loaded") ||
    line.includes("Targetting Null Entity") ||
    line.includes("CSCItemNavigation::GetStarmapRouteSegmentData")
  ) {
    return true;
  }

  return false;
}

// Centralized app state using Svelte 5 runes
class AppState {
  user = $state<UserProfile | null>(null);
  friends = $state<Friend[]>([]);
  friendRequests = $state<FriendRequestsResponse>({
    incoming: [],
    outgoing: [],
  });
  groups = $state<GroupWithMembers[]>([]);
  notifications = $state<Notification[]>([]);
  toasts = $state<ToastNotification[]>([]);
  connectionStatus = $state<ConnectionStatus>("disconnected");
  logs = $state<Log[]>([]);
  // Friend/group logs stored by ID for persistence across sessions
  friendLogs = $state<Map<string, Log[]>>(new Map());
  groupLogs = $state<Map<string, Log[]>>(new Map());
  token = $state<string | null>(null);
  uploadUrl = $state<string>("http://localhost:8080");
  uploadFetchFn = $state<typeof fetch>(fetch);
  isPlayerNameUpdating = $state<boolean>(false);

  // Getter for user info
  get userInfo() {
    return this.user;
  }

  // Platform detection: Check if running in Tauri (desktop app)
  get isDesktop(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof (window as any).__TAURI_INTERNALS__ !== "undefined"
    );
  }

  // Pending online status updates for friends not yet loaded (pagination fix)
  pendingOnlineStatusUpdates = $state<Map<string, boolean>>(new Map());

  // Processing requests tracking to prevent duplicate WebSocket requests
  processingRequests = $state<Set<string>>(new Set());

  // Ship session tracking for navigation/error log deduplication
  // Tracks the last ship ID that generated a navigation/error log per user
  lastShipErrorByUser = $state<Map<string, string>>(new Map());

  // Pagination state for friends
  friendsPagination = $state({
    currentPage: 1,
    hasMore: false,
    isLoading: false,
  });

  // Discovery state for browsing public groups
  discoverableGroups = $state<DiscoverableGroup[]>([]);
  discoverPagination = $state<PaginationMetadata>({
    page: 1,
    perPage: 20,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });
  discoverTags = $state<string[]>([]);
  discoverSearch = $state<string>("");
  discoverSelectedTags = $state<string[]>([]);
  discoverSortBy = $state<"popular" | "recent" | "name">("popular");
  discoverLoading = $state<boolean>(false);

  // Join requests for groups the user manages
  pendingJoinRequests = $state<Map<string, GroupJoinRequest[]>>(new Map());

  // Callback for fetching group members (set by App.svelte)
  fetchGroupMembers:
    | ((groupId: string, forceRefresh?: boolean) => Promise<void>)
    | null = null;

  // Callback for sending WebSocket requests (set by App.svelte)
  sendRequest:
    | (<T>(type: string, data?: any, timeout?: number) => Promise<T>)
    | null = null;

  // Callback for sending WebSocket requests with retry (set by App.svelte)
  sendRequestWithRetry:
    | (<T>(
        type: string,
        data?: any,
        maxRetries?: number,
        timeout?: number,
      ) => Promise<T>)
    | null = null;

  // Navigation and auth callbacks (set by desktop/website)
  navigate = $state<((path: string) => void) | undefined>(undefined);
  signOut = $state<(() => void) | undefined>(undefined);
  signIn = $state<(() => void) | undefined>(undefined);
  isSigningOut = $state<boolean>(false);
  isAuthenticating = $state<boolean>(false);

  // Desktop-specific state (optional)
  logLocation = $state<string | null>(null);
  selectLogFile = $state<(() => Promise<void>) | undefined>(undefined);
  resetWatcher = $state<(() => Promise<void>) | undefined>(undefined);

  // Header button visibility state (offline mode)
  hasSelectedLog = $state<boolean>(false);
  hasLogs = $state<boolean>(false);

  // Layout ready state (set by AuthLayout when connected + data loaded)
  layoutReady = $state<boolean>(false);

  // Active group/friend IDs now in filterState
  // Getters for backward compatibility
  get activeGroupId() {
    return filterState.activeGroupId;
  }

  get activeFriendId() {
    return filterState.activeFriendId;
  }

  // Current player name (Star Citizen character name) for scoreboard calculations
  currentPlayer = $state<string | null>(null);

  // Filter state now in filterState.svelte.ts
  // Getters for backward compatibility
  get enabledLogTypes() {
    return filterState.eventTypes;
  }

  get enabledPlayers() {
    return filterState.players;
  }

  // Constructor
  constructor() {
    // Filter state loads itself in filterState.svelte.ts
  }

  // Initialize effects (MUST be called from component context)
  // Svelte 5 runes like $effect can only be used during component initialization
  initializeEffects() {
    // Auto-clear deleted group/friend selections to prevent permanent empty state
    $effect(() => {
      // Watch for changes to friends and groups arrays
      const currentFriends = this.friends;
      const currentGroups = this.groups;
      const selectedFriendId = filterState.activeFriendId;
      const selectedGroupId = filterState.activeGroupId;

      // Clear activeFriendId if the selected friend no longer exists
      if (selectedFriendId) {
        const friendExists = currentFriends.some(
          (f) => f.friendUserId === selectedFriendId,
        );
        if (!friendExists) {
          console.log(
            "[AppState] Auto-clearing deleted friend selection:",
            selectedFriendId,
          );
          untrack(() => filterState.setActiveFriendId(null));
        }
      }

      // Clear activeGroupId if the selected group no longer exists
      // IMPORTANT: Only clear if group is truly deleted, not if members are just loading
      if (selectedGroupId) {
        const groupExists = currentGroups.some((g) => g.id === selectedGroupId);
        if (!groupExists) {
          console.log(
            "[AppState] Auto-clearing deleted group selection:",
            selectedGroupId,
          );
          untrack(() => filterState.setActiveGroupId(null));
        }
      }
    });

    // Auto-fetch group members when a group is selected (centralized state logic)
    // Using $effect for side effects (network requests) - Svelte 5 best practice
    // Debounced to prevent race conditions with dashboard data fetch
    let groupFetchTimeout: ReturnType<typeof setTimeout> | undefined;
    $effect(() => {
      // Create dependencies on these values (effect will re-run when they change)
      const isConnected = this.connectionStatus === "connected";
      const selectedGroup = filterState.activeGroupId;
      // IMPORTANT: Read groups array to create dependency - effect re-runs when groups load
      const currentGroups = this.groups;

      // Clear any pending timeout
      if (groupFetchTimeout) {
        clearTimeout(groupFetchTimeout);
        groupFetchTimeout = undefined;
      }

      // Only proceed if connected, a group is selected, and groups have loaded
      if (isConnected && selectedGroup && currentGroups.length > 0) {
        // Debounce to avoid race condition with dashboard data fetch
        groupFetchTimeout = setTimeout(() => {
          // Find the group in the current groups array
          const group = currentGroups.find((g) => g.id === selectedGroup);

          // Check if group exists and needs member data
          if (group && (!group.members || group.members.length === 0)) {
            // Call the fetchGroupMembers callback if available
            if (this.fetchGroupMembers) {
              this.fetchGroupMembers(selectedGroup);
            }
          }
        }, 100); // 100ms debounce
      }
    });

    // Update available players when logs change
    $effect(() => {
      filterState.setAvailablePlayers(this.logs);
    });

    // Calculate scoreboard entries reactively
    // Runs after logs are loaded from localStorage (in component context)
    $effect(() => {
      this.scoreboardEntries = calculateScoreboard(
        this.logs,
        this.currentPlayer,
        this.user?.discordId ?? null,
        this.activeGroupId,
        this.friends,
        this.groups,
      );
    });
  }

  // Derived display name for current user
  displayName = $derived(this.user ? getDisplayName(this.user) : null);

  // Derived friends list with computed display names
  friendsWithDisplayNames = $derived(
    this.friends.map((friend) => ({
      ...friend,
      displayName: (friend as any).friendUsername
        ? getDisplayName({
            username: (friend as any).friendUsername,
            player: (friend as any).friendPlayer,
            usePlayerAsDisplayName: (friend as any)
              .friendUsePlayerAsDisplayName,
          })
        : (friend as any).displayName || "Unknown",
    })),
  );

  // Single-pass filtered logs with all filters applied
  filteredLogs = $derived.by(() => {
    // Pre-compute filter conditions
    const hasTypeFilter = filterState.eventTypes.size < ALL_LOG_TYPES.length;
    const hasAvailablePlayers = filterState.availablePlayers.length > 0;

    // Build context filter (friend/group) and merge cached logs
    let contextFilter: ((log: Log) => boolean) | null = null;
    let logsToFilter = this.logs;

    if (filterState.activeFriendId) {
      const friend = this.friends.find(
        (f) => f.friendUserId === filterState.activeFriendId,
      );
      if (!friend) return [];
      const friendDiscordId = friend.friendDiscordId;
      contextFilter = (log) => log.userId === friendDiscordId;

      // Merge cached friend logs with current logs
      const cachedLogs = this.friendLogs.get(friendDiscordId) || [];
      if (cachedLogs.length > 0) {
        logsToFilter = dedupeAndSortLogs([...this.logs, ...cachedLogs]);
      }
    } else if (filterState.activeGroupId) {
      const group = this.groups.find((g) => g.id === filterState.activeGroupId);
      if (!group || !hasMembers(group)) return [];
      const memberIds = new Set(
        group.members
          .map((m) => m.discordId)
          .filter((id): id is string => id != null),
      );
      contextFilter = (log) => memberIds.has(log.userId);

      // Merge cached group logs with current logs
      const cachedLogs = this.groupLogs.get(filterState.activeGroupId) || [];
      if (cachedLogs.length > 0) {
        logsToFilter = dedupeAndSortLogs([...this.logs, ...cachedLogs]);
      }
    }

    // Pre-compute enabled sets for O(1) lookup
    const enabledTypes = filterState.eventTypes;
    const selectedPlayers = filterState.players;

    // Ship-based deduplication tracking
    const seenShipsByUser = new Map<string, string>();

    // Single pass through logs with all filters
    return logsToFilter.filter((log) => {
      // Context filter (friend/group)
      if (contextFilter && !contextFilter(log)) return false;

      // Event type filter
      if (hasTypeFilter && log.eventType && !enabledTypes.has(log.eventType))
        return false;

      // Player filter
      // Check all players in the log (owner, killer, victim, cause)
      // Always filter when there are available players
      if (hasAvailablePlayers) {
        const logPlayers = extractPlayersFromLog(log);
        let hasMatch = false;
        for (const player of logPlayers) {
          if (selectedPlayers.has(player)) {
            hasMatch = true;
            break;
          }
        }
        if (!hasMatch) return false;
      }

      // Ship-based deduplication for navigation/error logs
      if (isNavigationOrErrorLog(log)) {
        const vehicleId = log.metadata?.vehicleId;
        const userId = log.userId;

        if (vehicleId && userId) {
          const lastShipId = seenShipsByUser.get(userId);
          if (lastShipId === vehicleId) return false;
          seenShipsByUser.set(userId, vehicleId);
        }
      }

      return true;
    });
  });

  // Derived session statistics for current player
  sessionStats = $derived(calculateSessionStats(this.logs, this.currentPlayer));

  // Scoreboard entries for all players (calculated in $effect)
  scoreboardEntries = $state<ScoreboardEntry[]>([]);

  // Helper to initialize state from server data
  async initialize(data: {
    user: UserProfile;
    friends?: Friend[];
    friendRequests?: FriendRequestsResponse;
    groups?: GroupWithMembers[];
    notifications?: Notification[];
    connectionStatus?: ConnectionStatus;
  }) {
    // Merge user data to preserve fields not in the response (e.g., during character swap)
    if (this.user) {
      this.mergeUser(data.user);
    } else {
      this.user = data.user;
    }

    // Load logs from storage (with 7-day expiry and auto-pruning)
    if (typeof window !== "undefined" && this.user?.discordId) {
      const cachedLogs = await loadLogs(this.user.discordId);
      if (cachedLogs.length > 0) {
        // Merge cached logs with any existing logs and apply memory limit
        this.logs = applyMemoryLimit(
          dedupeAndSortLogs([...this.logs, ...cachedLogs]),
        );
      }
    }

    // Load friend/group logs from storage (will be loaded after friends/groups are set below)
    // Deferred to avoid blocking initialization

    // Smart merge for friends: preserve existing cache if we have more data than server provides
    const incomingFriends = data.friends || [];
    const currentFriendsCount = this.friends.length;

    if (
      currentFriendsCount > incomingFriends.length &&
      incomingFriends.length > 0
    ) {
      // We have paginated data cached - preserve it and only update matching friends
      const friendsMap = new Map(
        this.friends.map((f) => [f.friendDiscordId, f]),
      );
      incomingFriends.forEach((newFriend) => {
        friendsMap.set(newFriend.friendDiscordId, newFriend);
      });
      this.friends = Array.from(friendsMap.values());
    } else if (incomingFriends.length > 0) {
      // Server has more data or we have empty cache - use server data
      // Apply pending online status updates when initializing friends
      if (this.pendingOnlineStatusUpdates.size > 0) {
        this.friends = incomingFriends.map((friend) => {
          const pendingStatus = this.pendingOnlineStatusUpdates.get(
            friend.friendDiscordId,
          );
          if (pendingStatus !== undefined) {
            this.pendingOnlineStatusUpdates.delete(friend.friendDiscordId);
            return { ...friend, isOnline: pendingStatus };
          }
          return friend;
        });
      } else {
        this.friends = incomingFriends;
      }
    }
    // If incomingFriends is empty, preserve existing cache

    // Smart merge for groups: preserve existing cache if we have more data
    const incomingGroups = data.groups || [];
    const currentGroupsCount = this.groups.length;

    if (
      currentGroupsCount > incomingGroups.length &&
      incomingGroups.length > 0
    ) {
      // We have cached data - preserve it and only update matching groups
      const groupsMap = new Map(this.groups.map((g) => [g.id, g]));
      incomingGroups.forEach((newGroup) => {
        const existing = groupsMap.get(newGroup.id);
        groupsMap.set(newGroup.id, {
          ...newGroup,
          members: existing?.members || newGroup.members || [],
        });
      });
      this.groups = Array.from(groupsMap.values());
    } else if (incomingGroups.length > 0) {
      // Server has more data or we have empty cache - use server data
      this.groups = incomingGroups;
    }
    // If incomingGroups is empty, preserve existing cache

    this.friendRequests = data.friendRequests || { incoming: [], outgoing: [] };
    this.notifications = data.notifications || [];
    this.connectionStatus = data.connectionStatus || "disconnected";

    // Load cached friend/group logs from storage (non-blocking)
    if (typeof window !== "undefined") {
      this.loadRemoteLogs();
    }
  }

  /**
   * Load cached friend/group logs from storage
   * Called after friends and groups are initialized
   */
  private async loadRemoteLogs() {
    // Load friend logs
    for (const friend of this.friends) {
      try {
        const cached = await loadFriendLogs(friend.friendDiscordId);
        if (cached.length > 0) {
          this.friendLogs.set(friend.friendDiscordId, cached);
        }
      } catch (error) {
        console.error(
          `[AppState] Failed to load logs for friend ${friend.friendDiscordId}:`,
          error,
        );
      }
    }

    // Load group logs
    for (const group of this.groups) {
      try {
        const cached = await loadGroupLogs(group.id);
        if (cached.length > 0) {
          this.groupLogs.set(group.id, cached);
        }
      } catch (error) {
        console.error(
          `[AppState] Failed to load logs for group ${group.id}:`,
          error,
        );
      }
    }
  }

  // Setters
  setUser(user: UserProfile | null) {
    // Replace user entirely - WebSocket responses include complete user objects
    this.user = user;
  }

  mergeUser(updates: Partial<UserProfile>) {
    // Merge partial updates with existing user - preserves fields not in updates (like avatar)
    if (this.user) {
      // Filter out undefined values to prevent overwriting existing data
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined),
      );
      this.user = { ...this.user, ...cleanUpdates };
    }
  }

  setFriends(friends: Friend[]) {
    // Create map of existing friends to preserve online status
    const existingMap = new Map(
      this.friends.map((f) => [f.friendDiscordId, f]),
    );

    const mappedFriends = friends.map((friend) => {
      // First check pending updates
      const pendingStatus = this.pendingOnlineStatusUpdates.get(
        friend.friendDiscordId,
      );
      if (pendingStatus !== undefined) {
        this.pendingOnlineStatusUpdates.delete(friend.friendDiscordId);
        return {
          ...friend,
          isOnline: pendingStatus,
          isConnected: pendingStatus,
        };
      }

      // Then check existing friends for current online status
      const existing = existingMap.get(friend.friendDiscordId);
      if (existing) {
        return {
          ...friend,
          isOnline: existing.isOnline ?? friend.isOnline,
          isConnected: existing.isConnected ?? friend.isConnected,
        };
      }

      return friend;
    });

    // Preserve Svelte 5 $state proxy by mutating instead of reassigning
    this.friends.splice(0, this.friends.length, ...mappedFriends);
  }

  setFriendRequests(requests: FriendRequestsResponse) {
    this.friendRequests = requests;
  }

  setGroups(groups: GroupWithMembers[]) {
    // Ensure each group has a members property (even if empty)
    // This prevents undefined checks from failing in filteredLogs getter
    const mappedGroups = groups.map((group) => ({
      ...group,
      members: group.members || [],
    }));

    // Preserve Svelte 5 $state proxy by mutating instead of reassigning
    this.groups.splice(0, this.groups.length, ...mappedGroups);
  }

  setNotifications(notifications: Notification[]) {
    // Preserve Svelte 5 $state proxy by mutating instead of reassigning
    this.notifications.splice(0, this.notifications.length, ...notifications);
  }

  setConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
  }

  // Add friend
  addFriend(friend: Friend) {
    // Check if friend already exists to prevent duplicates (Bug #2 fix)
    // Match by both id (friendship ID) and friendDiscordId (user Discord ID)
    const exists = this.friends.some(
      (f) => f.id === friend.id || f.friendDiscordId === friend.friendDiscordId,
    );

    if (!exists) {
      this.friends = [...this.friends, friend];
    }
  }

  // Remove friend
  removeFriend(friendId: string) {
    // Find the friend to get their Discord ID for log cleanup
    const friend = this.friends.find((f) => f.id === friendId);
    if (friend) {
      // Clear stored logs for this friend
      this.friendLogs.delete(friend.friendDiscordId);
      if (typeof window !== "undefined") {
        clearFriendLogs(friend.friendDiscordId).catch((error) => {
          console.error(
            `[AppState] Failed to clear logs for friend ${friend.friendDiscordId}:`,
            error,
          );
        });
      }
    }
    this.friends = this.friends.filter((f) => f.id !== friendId);
  }

  // Add friend request
  addFriendRequest(request: FriendRequest) {
    if (request.direction === "incoming") {
      this.friendRequests.incoming = [...this.friendRequests.incoming, request];
    } else {
      this.friendRequests.outgoing = [...this.friendRequests.outgoing, request];
    }
  }

  // Remove friend request
  removeFriendRequest(requestId: string) {
    this.friendRequests.incoming = this.friendRequests.incoming.filter(
      (r) => r.id !== requestId,
    );
    this.friendRequests.outgoing = this.friendRequests.outgoing.filter(
      (r) => r.id !== requestId,
    );
  }

  // Add group
  addGroup(group: GroupWithMembers) {
    this.groups = [...this.groups, { ...group, members: group.members || [] }];
  }

  // Remove group
  removeGroup(groupId: string) {
    // Clear stored logs for this group
    this.groupLogs.delete(groupId);
    if (typeof window !== "undefined") {
      clearGroupLogs(groupId).catch((error) => {
        console.error(
          `[AppState] Failed to clear logs for group ${groupId}:`,
          error,
        );
      });
    }
    this.groups = this.groups.filter((g) => g.id !== groupId);
  }

  // Add notification
  addNotification(notification: Notification) {
    this.notifications = [...this.notifications, notification];
  }

  // Mark notification as read
  markNotificationRead(notificationId: string) {
    this.notifications = this.notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n,
    );
  }

  // Remove notification
  removeNotification(notificationId: string) {
    this.notifications = this.notifications.filter(
      (n) => n.id !== notificationId,
    );
  }

  // Clear all notifications
  clearNotifications() {
    this.notifications = [];
  }

  // Get unread notification count
  get unreadCount() {
    // Guard against undefined/null during Svelte 5 $state initialization
    if (!this.notifications || !Array.isArray(this.notifications)) {
      return 0;
    }
    return this.notifications.filter((n) => !n.read).length;
  }

  // Add toast notification
  addToast(
    message: string,
    type: "success" | "error" | "info" = "info",
    options?: {
      customIcon?: string;
      avatarUrl?: string;
      autoDismiss?: boolean;
    },
  ) {
    const toast: ToastNotification = {
      id: crypto.randomUUID(),
      message,
      type,
      customIcon: options?.customIcon,
      avatarUrl: options?.avatarUrl,
      autoDismiss: options?.autoDismiss ?? true,
    };
    this.toasts = [...this.toasts, toast];
  }

  // Remove toast notification
  removeToast(toastId: string) {
    this.toasts = this.toasts.filter((t) => t.id !== toastId);
  }

  // Clear all toasts
  clearToasts() {
    this.toasts = [];
  }

  // Get group invitations (transforms Notification[] to GroupInvitation[])
  get groupInvitations(): GroupInvitation[] {
    // Guard against undefined/null during Svelte 5 $state initialization
    if (!this.notifications || !Array.isArray(this.notifications)) {
      return [];
    }

    return this.notifications
      .filter((n) => n.type === "group_invitation")
      .map((n) => {
        const data = n.data as GroupInvitationNotificationData;
        return {
          id: data.invitationId,
          groupId: data.groupId,
          group: {
            id: data.groupId,
            name: data.groupName,
            avatar: data.groupAvatar,
          },
          inviterId: data.inviterId,
          inviterUsername: data.inviterUsername,
          inviterDisplayName: data.inviterDisplayName,
          inviterAvatar: data.inviterAvatar,
          createdAt: n.createdAt,
          status: "pending",
        } as GroupInvitation;
      });
  }

  // Get all pending join requests as a flat array (for notification dropdown)
  get allPendingJoinRequests(): GroupJoinRequest[] {
    const requests: GroupJoinRequest[] = [];
    for (const groupRequests of this.pendingJoinRequests.values()) {
      requests.push(...groupRequests);
    }
    // Sort by createdAt descending (newest first)
    return requests.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // Update friend online status
  updateFriendOnlineStatus(friendDiscordId: string, isOnline: boolean) {
    // Try to find the friend in the current list
    const friendIndex = this.friends.findIndex(
      (f) => f.friendDiscordId === friendDiscordId,
    );

    if (friendIndex !== -1) {
      // Friend found - mutate in place for Svelte 5 reactivity
      this.friends[friendIndex] = {
        ...this.friends[friendIndex],
        isOnline,
        isConnected: isOnline,
      };
    } else {
      // Friend not found (likely on unloaded page) - store as pending update
      this.pendingOnlineStatusUpdates.set(friendDiscordId, isOnline);
    }
  }

  // Update group data
  updateGroup(groupId: string, data: Partial<GroupWithMembers>) {
    this.groups = this.groups.map((g) =>
      g.id === groupId
        ? { ...g, ...data, members: data.members ?? g.members ?? [] }
        : g,
    );
  }

  // Add log
  addLog(log: Log) {
    // Ship-based deduplication for navigation/error logs
    // Only show one navigation error per ship session
    if (isNavigationOrErrorLog(log)) {
      const vehicleId = log.metadata?.vehicleId;
      const userId = log.userId;

      if (vehicleId && userId) {
        // Create a unique key for this user's ship session
        const userKey = userId;
        const lastShipId = this.lastShipErrorByUser.get(userKey);

        // If we've already shown a navigation error for this ship, skip it
        if (lastShipId === vehicleId) {
          return;
        }

        // Update the last ship that generated a navigation error for this user
        this.lastShipErrorByUser.set(userKey, vehicleId);
      }
    }

    this.logs = [...this.logs, log];

    // Save to storage (fire-and-forget, no await)
    if (typeof window !== "undefined" && this.user?.discordId) {
      saveLogs(this.user.discordId, this.logs).catch((error) => {
        console.error("Failed to save logs:", error);
      });
    }
  }

  // Add multiple logs with deduplication
  addLogs(logs: Log[]) {
    // Skip if no logs provided
    if (logs.length === 0) {
      return;
    }

    // Ship-based deduplication for navigation/error logs
    // Filter out navigation errors that match the last seen ship for each user
    const logsToAdd = logs.filter((log) => {
      if (isNavigationOrErrorLog(log)) {
        const vehicleId = log.metadata?.vehicleId;
        const userId = log.userId;

        if (vehicleId && userId) {
          const userKey = userId;
          const lastShipId = this.lastShipErrorByUser.get(userKey);

          // If we've already shown a navigation error for this ship, skip it
          if (lastShipId === vehicleId) {
            return false;
          }

          // Update the last ship that generated a navigation error for this user
          this.lastShipErrorByUser.set(userKey, vehicleId);
        }
      }

      return true;
    });

    // If all logs were filtered out, skip
    if (logsToAdd.length === 0) {
      return;
    }

    // Merge with existing logs, deduplicate by ID, and sort by timestamp
    // dedupeAndSortLogs handles duplicates, so no need to filter by userId
    const merged = dedupeAndSortLogs([...this.logs, ...logsToAdd]);

    // Apply memory limit (default: 1000 logs)
    this.logs = applyMemoryLimit(merged);

    // Save to storage (fire-and-forget, no await)
    if (typeof window !== "undefined" && this.user?.discordId) {
      saveLogs(this.user.discordId, this.logs).catch((error) => {
        console.error("Failed to save logs:", error);
      });
    }
  }

  // Set logs directly (used by desktop app to feed processed logs)
  setLogs(logs: Log[]) {
    this.logs = logs;
    filterState.setAvailablePlayers(logs);
  }

  /**
   * Add logs from a friend (persists to storage)
   * @param friendDiscordId - The Discord ID of the friend who sent the logs
   * @param logs - The logs to add
   */
  async addFriendLogs(friendDiscordId: string, logs: Log[]) {
    if (logs.length === 0) return;

    // Get existing logs for this friend
    const existing = this.friendLogs.get(friendDiscordId) || [];

    // Merge with new logs
    const merged = dedupeAndSortLogs([...existing, ...logs]);

    // Apply memory limit
    const limited = applyMemoryLimit(merged);

    // Update in-memory state
    this.friendLogs.set(friendDiscordId, limited);

    // Also add to main logs array for display
    this.addLogs(logs);

    // Persist to storage (fire-and-forget)
    if (typeof window !== "undefined") {
      saveFriendLogs(friendDiscordId, limited).catch((error) => {
        console.error(
          `[AppState] Failed to save friend logs for ${friendDiscordId}:`,
          error,
        );
      });
    }
  }

  /**
   * Add logs from a group (persists to storage)
   * @param groupId - The ID of the group
   * @param logs - The logs to add
   */
  async addGroupLogs(groupId: string, logs: Log[]) {
    if (logs.length === 0) return;

    // Get existing logs for this group
    const existing = this.groupLogs.get(groupId) || [];

    // Merge with new logs
    const merged = dedupeAndSortLogs([...existing, ...logs]);

    // Apply memory limit
    const limited = applyMemoryLimit(merged);

    // Update in-memory state
    this.groupLogs.set(groupId, limited);

    // Also add to main logs array for display
    this.addLogs(logs);

    // Persist to storage (fire-and-forget)
    if (typeof window !== "undefined") {
      saveGroupLogs(groupId, limited).catch((error) => {
        console.error(
          `[AppState] Failed to save group logs for ${groupId}:`,
          error,
        );
      });
    }
  }

  /**
   * Get cached logs for a friend
   */
  getFriendLogs(friendDiscordId: string): Log[] {
    return this.friendLogs.get(friendDiscordId) || [];
  }

  /**
   * Get cached logs for a group
   */
  getGroupLogs(groupId: string): Log[] {
    return this.groupLogs.get(groupId) || [];
  }

  // Clear all logs
  clearLogs() {
    this.logs = [];

    // Clear ship session tracking
    this.lastShipErrorByUser.clear();

    // Clear storage cache (fire-and-forget)
    if (typeof window !== "undefined" && this.user?.discordId) {
      clearLogStorage(this.user.discordId).catch((error) => {
        console.error("Failed to clear logs from storage:", error);
      });
    }
  }

  // Refresh logs (clears cache to force re-fetch of fresh data)
  // Used when changing friend/group selection to ensure fresh data is displayed
  refreshLogs() {
    // Desktop apps use file watcher which maintains its own log array via incremental parsing
    // Clearing logs breaks the watcher (only new lines are parsed, not entire file)
    if (this.isDesktop) {
      console.log(
        "[AppState] Desktop mode - skipping log clear (file watcher manages logs)",
      );
      // Still clear localStorage to force fresh data on next watcher callback
      if (typeof window !== "undefined" && this.user?.discordId) {
        clearLogStorage(this.user.discordId);
      }
      return;
    }

    // Website mode - clear logs to force re-fetch via WebSocket
    console.log("[AppState] Website mode - clearing logs for refresh");
    this.logs = [];

    // Clear ship session tracking
    this.lastShipErrorByUser.clear();

    // Clear localStorage cache to force fresh data load
    if (typeof window !== "undefined" && this.user?.discordId) {
      clearLogStorage(this.user.discordId);
    }
  }

  // Clear app state when player name changes (switching characters)
  // Preserves user profile and connection, clears all dynamic data
  clearStateForPlayerChange() {
    console.log("[AppState] Clearing state for player name change");

    // Clear social data (will be refreshed from server)
    // IMPORTANT: Mutate arrays to preserve Svelte 5 $state proxy, don't reassign!
    this.friends.length = 0;
    this.friendRequests.incoming.length = 0;
    this.friendRequests.outgoing.length = 0;
    this.groups.length = 0;
    this.notifications.length = 0;

    // Clear pagination state
    this.friendsPagination = {
      currentPage: 1,
      hasMore: false,
      isLoading: false,
    };

    // Clear selection state (no longer valid with new character)
    filterState.setActiveGroupId(null);
    filterState.setActiveFriendId(null);

    // Clear logs (user is switching characters)
    this.clearLogs();

    // Clear toasts (remove any lingering notifications from previous character)
    this.clearToasts();

    // Clear pending updates
    this.pendingOnlineStatusUpdates.clear();
    this.processingRequests.clear();

    // Reset filter state
    filterState.reset();

    // Update current player to null (will be set after refresh)
    this.currentPlayer = null;

    console.log("[AppState] State cleared, ready for refresh");
  }

  /**
   * Reset all app state (used on logout)
   * Clears all accumulated data to prevent memory leaks
   */
  reset() {
    console.log("[AppState] Resetting all state");

    // Clear user data
    this.user = null;
    this.token = null;

    // Clear social data (mutate arrays to preserve Svelte 5 $state proxy)
    this.friends.length = 0;
    this.friendRequests = { incoming: [], outgoing: [] };
    this.groups.length = 0;
    this.notifications.length = 0;
    this.toasts.length = 0;

    // Clear logs
    this.logs.length = 0;

    // Clear Maps and Sets
    this.pendingOnlineStatusUpdates.clear();
    this.processingRequests.clear();
    this.lastShipErrorByUser.clear();

    // Reset pagination
    this.friendsPagination = {
      currentPage: 1,
      hasMore: false,
      isLoading: false,
    };

    // Clear selection state
    filterState.setActiveGroupId(null);
    filterState.setActiveFriendId(null);
    filterState.reset();

    // Clear callbacks (will be re-registered on next mount)
    this.fetchGroupMembers = null;
    this.sendRequest = null;
    this.sendRequestWithRetry = null;

    // Reset flags
    this.currentPlayer = null;
    this.layoutReady = false;
    this.connectionStatus = "disconnected";

    console.log("[AppState] State reset complete");
  }

  // Set active group ID
  setActiveGroupId(groupId: string | null) {
    filterState.setActiveGroupId(groupId);
  }

  // Set active friend ID
  setActiveFriendId(friendId: string | null) {
    filterState.setActiveFriendId(friendId);
  }

  // Update profile (uses sendRequest callback)
  // Returns the response with playerChanged flag for the caller to handle
  async updateProfile(
    data: ProfileUpdateData,
  ): Promise<UserProfile & { playerChanged?: boolean }> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const oldPlayer = this.user?.player;
      const oldUsePlayerAsDisplayName = this.user?.usePlayerAsDisplayName;

      const response = await this.sendRequest<
        UserProfile & { playerChanged?: boolean }
      >("update_user_profile", data);

      console.log("[AppState] Profile update response:", {
        oldPlayer,
        newPlayer: response?.player,
        oldUsePlayerAsDisplayName,
        newUsePlayerAsDisplayName: response?.usePlayerAsDisplayName,
      });

      // Update local user state
      if (this.user && response) {
        // Create new object reference to trigger reactivity
        this.user = { ...this.user, ...response };

        console.log("[AppState] User state updated:", {
          player: this.user.player,
          displayName: this.displayName,
          usePlayerAsDisplayName: this.user.usePlayerAsDisplayName,
        });

        // If display-related fields changed, refresh group members
        const displayChanged =
          response.player !== oldPlayer ||
          response.usePlayerAsDisplayName !== oldUsePlayerAsDisplayName;

        if (displayChanged && this.groups.length > 0) {
          console.log(
            "[AppState] Display changed, clearing group member caches and refreshing",
          );

          // Clear localStorage cache for ALL groups (defensive - ensures stale data is cleared)
          // This is needed because the WebSocket handler's case "user_profile_updated"
          // doesn't run for the requesting client due to early return after promise resolution
          if (typeof window !== "undefined") {
            for (const group of this.groups) {
              const cacheKey = `picologs:groupMembers:${group.id}`;
              localStorage.removeItem(cacheKey);
              console.log(`[AppState] Cleared cache for group "${group.name}"`);
            }
          }

          // Then fetch updated data for groups that are loaded and contain current user
          if (this.fetchGroupMembers) {
            for (const group of this.groups) {
              if (
                group.members?.some((m) => m.discordId === this.user?.discordId)
              ) {
                console.log(
                  `[AppState] Refreshing members for group "${group.name}"`,
                );
                // Force refresh to get updated display name
                this.fetchGroupMembers(group.id, true).catch((err) => {
                  console.error(
                    `[AppState] Failed to refresh group ${group.id}:`,
                    err,
                  );
                });
              }
            }
          }
        }
      }

      // Return response so caller can check playerChanged flag
      return response;
    } catch (error) {
      console.error("[AppState] Failed to update profile:", error);
      throw error;
    }
  }

  // Simple player name update without destroying state
  // Use this when you just need to update the local player name
  updatePlayerName(player: string | null) {
    if (this.user) {
      this.user = { ...this.user, player };
      this.currentPlayer = player;
      console.log("[AppState] Player name updated locally:", player);
    }
  }

  // Delete profile (uses sendRequest callback)
  async deleteProfile(): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<void>("delete_user_profile");
    } catch (error) {
      console.error("[AppState] Failed to delete profile:", error);
      throw error;
    }
  }

  // Send friend request (uses sendRequest callback)
  async sendFriendRequest(friendCode: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<FriendRequest>(
        "send_friend_request",
        { friendCode },
      );

      // Add to outgoing requests
      if (response) {
        this.addFriendRequest(response);
      }

      this.addToast("Friend request sent", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to send friend request:", error);
      this.addToast(error.message || "Failed to send friend request", "error");
      throw error;
    }
  }

  // Send friend request by Discord ID (for group member lists)
  async sendFriendRequestByDiscordId(discordId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<FriendRequest>(
        "send_friend_request",
        { discordId },
      );

      if (response) {
        this.addFriendRequest(response);
      }

      this.addToast("Friend request sent", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to send friend request:", error);
      this.addToast(error.message || "Failed to send friend request", "error");
      throw error;
    }
  }

  // Accept friend request (uses sendRequest callback)
  async acceptFriendRequest(friendshipId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    // Prevent duplicate requests
    if (this.processingRequests.has(friendshipId)) {
      return;
    }

    // Save request object for rollback
    const request = this.friendRequests.incoming.find(
      (r) => r.id === friendshipId,
    );

    // OPTIMISTIC: Remove notification immediately
    this.removeFriendRequest(friendshipId);
    this.processingRequests.add(friendshipId);

    try {
      const response = await this.sendRequest<Friend>("accept_friend_request", {
        friendshipId,
      });

      // Add to friends list with full data from server
      if (response) {
        this.addFriend(response);
      }

      this.addToast("Friend request accepted", "success");
    } catch (error: any) {
      // ROLLBACK: Add request back on error
      if (request) {
        this.friendRequests.incoming.push(request);
      }
      console.error("[AppState] Failed to accept friend request:", error);
      this.addToast(
        error.message || "Failed to accept friend request",
        "error",
      );
      throw error;
    } finally {
      this.processingRequests.delete(friendshipId);
    }
  }

  // Deny friend request (uses sendRequest callback)
  async denyFriendRequest(friendshipId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    // Prevent duplicate requests
    if (this.processingRequests.has(friendshipId)) {
      return;
    }

    // Save request object for rollback
    const request = this.friendRequests.incoming.find(
      (r) => r.id === friendshipId,
    );

    // OPTIMISTIC: Remove notification immediately
    this.removeFriendRequest(friendshipId);
    this.processingRequests.add(friendshipId);

    try {
      await this.sendRequest<void>("deny_friend_request", { friendshipId });
      this.addToast("Friend request denied", "success");
    } catch (error: any) {
      // ROLLBACK: Add request back on error
      if (request) {
        this.friendRequests.incoming.push(request);
      }
      console.error("[AppState] Failed to deny friend request:", error);
      this.addToast(error.message || "Failed to deny friend request", "error");
      throw error;
    } finally {
      this.processingRequests.delete(friendshipId);
    }
  }

  // Cancel friend request (uses sendRequest callback)
  async cancelFriendRequest(friendshipId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<void>("cancel_friend_request", { friendshipId });
      this.removeFriendRequest(friendshipId);
      this.addToast("Friend request cancelled", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to cancel friend request:", error);
      this.addToast(
        error.message || "Failed to cancel friend request",
        "error",
      );
      throw error;
    }
  }

  // Remove friend (uses sendRequest callback)
  async removeFriendship(friendshipId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<void>("remove_friend", { friendshipId });
      this.removeFriend(friendshipId);
      this.addToast("Friend removed", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to remove friend:", error);
      this.addToast(error.message || "Failed to remove friend", "error");
      throw error;
    }
  }

  // Accept group invitation (uses sendRequest callback)
  async acceptGroupInvitation(invitationId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    // Prevent duplicate requests
    if (this.processingRequests.has(invitationId)) {
      return;
    }

    // Save notification object for rollback
    const invitation = this.notifications.find((n) => {
      if (n.type === "group_invitation") {
        const data = n.data as GroupInvitationNotificationData;
        return data.invitationId === invitationId;
      }
      return false;
    });

    // OPTIMISTIC: Remove notification immediately
    this.notifications = this.notifications.filter((n) => {
      if (n.type === "group_invitation") {
        const data = n.data as GroupInvitationNotificationData;
        return data.invitationId !== invitationId;
      }
      return true;
    });
    this.processingRequests.add(invitationId);

    try {
      const response = await this.sendRequest<{
        invitationId: string;
        groupId: string;
        group: Group;
      }>("accept_group_invitation", { invitationId });

      // Add the group to state immediately
      if (response && response.group) {
        this.addGroup({ ...response.group, members: [] });
      }

      this.addToast("Group invitation accepted", "success");
    } catch (error: any) {
      // ROLLBACK: Add notification back on error
      if (invitation) {
        this.notifications.push(invitation);
      }
      console.error("[AppState] Failed to accept group invitation:", error);
      this.addToast(
        error.message || "Failed to accept group invitation",
        "error",
      );
      throw error;
    } finally {
      this.processingRequests.delete(invitationId);
    }
  }

  // Deny group invitation (uses sendRequest callback)
  async denyGroupInvitation(invitationId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    // Prevent duplicate requests
    if (this.processingRequests.has(invitationId)) {
      return;
    }

    // Save notification object for rollback
    const invitation = this.notifications.find((n) => {
      if (n.type === "group_invitation") {
        const data = n.data as GroupInvitationNotificationData;
        return data.invitationId === invitationId;
      }
      return false;
    });

    // OPTIMISTIC: Remove notification immediately
    this.notifications = this.notifications.filter((n) => {
      if (n.type === "group_invitation") {
        const data = n.data as GroupInvitationNotificationData;
        return data.invitationId !== invitationId;
      }
      return true;
    });
    this.processingRequests.add(invitationId);

    try {
      await this.sendRequest<void>("deny_group_invitation", { invitationId });
      this.addToast("Group invitation denied", "success");
    } catch (error: any) {
      // ROLLBACK: Add notification back on error
      if (invitation) {
        this.notifications.push(invitation);
      }
      console.error("[AppState] Failed to deny group invitation:", error);
      this.addToast(
        error.message || "Failed to deny group invitation",
        "error",
      );
      throw error;
    } finally {
      this.processingRequests.delete(invitationId);
    }
  }

  // Cancel group invitation (uses sendRequest callback)
  async cancelGroupInvitation(invitationId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<void>("cancel_group_invitation", { invitationId });
      this.addToast("Invitation cancelled", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to cancel invitation:", error);
      this.addToast(error.message || "Failed to cancel invitation", "error");
      throw error;
    }
  }

  // Load more friends (pagination)
  async loadMoreFriends(): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    if (this.friendsPagination.isLoading || !this.friendsPagination.hasMore) {
      return;
    }

    this.friendsPagination.isLoading = true;

    try {
      const nextPage = this.friendsPagination.currentPage + 1;
      const response = await this.sendRequest<{
        friends: Friend[];
        hasMore: boolean;
      }>("get_friends", { page: nextPage });

      // Append new friends to existing list
      let newFriends = response.friends;

      // Apply pending online status updates to newly loaded friends
      if (this.pendingOnlineStatusUpdates.size > 0) {
        newFriends = newFriends.map((friend) => {
          const pendingStatus = this.pendingOnlineStatusUpdates.get(
            friend.friendDiscordId,
          );
          if (pendingStatus !== undefined) {
            // Clear this pending update since we're applying it now
            this.pendingOnlineStatusUpdates.delete(friend.friendDiscordId);
            return { ...friend, isOnline: pendingStatus };
          }
          return friend;
        });
      }

      this.friends = [...this.friends, ...newFriends];
      this.friendsPagination.currentPage = nextPage;
      this.friendsPagination.hasMore = response.hasMore;
    } catch (error) {
      console.error("[AppState] Failed to load more friends:", error);
      this.addToast("Failed to load more friends", "error");
      throw error;
    } finally {
      this.friendsPagination.isLoading = false;
    }
  }

  // Create group (uses sendRequest callback)
  async createGroup(data: {
    name: string;
    description?: string;
    avatar?: string;
    tags?: string[];
  }): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<{ group: Group }>(
        "create_group",
        data,
      );
      this.addGroup({ ...response.group, members: [] });
      this.addToast("Group created successfully", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to create group:", error);
      this.addToast(error.message || "Failed to create group", "error");
      throw error;
    }
  }

  // Update group (uses sendRequest callback)
  async updateGroupData(data: {
    groupId: string;
    name?: string;
    description?: string;
    avatar?: string;
    tags?: string[];
  }): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<Group>("update_group", data);
      const existingGroup = this.groups.find((g) => g.id === data.groupId);
      this.updateGroup(data.groupId, {
        ...response,
        members: existingGroup?.members || [],
      });
      this.addToast("Group updated successfully", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to update group:", error);
      this.addToast(error.message || "Failed to update group", "error");
      throw error;
    }
  }

  // Leave group (uses sendRequest callback)
  async leaveGroup(groupId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<void>("leave_group", { groupId });
      this.removeGroup(groupId);
      this.addToast("Left group successfully", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to leave group:", error);
      this.addToast(error.message || "Failed to leave group", "error");
      throw error;
    }
  }

  // Delete group (uses sendRequest callback)
  async deleteGroup(groupId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<void>("delete_group", { groupId });
      this.removeGroup(groupId);
      this.addToast("Group deleted successfully", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to delete group:", error);
      this.addToast(error.message || "Failed to delete group", "error");
      throw error;
    }
  }

  // Invite friend to group (uses sendRequest callback)
  async inviteFriendToGroup(
    groupId: string,
    friendDiscordId: string,
  ): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<void>("invite_friend_to_group", {
        groupId,
        friendDiscordId,
      });
      this.addToast("Invitation sent", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to invite friend:", error);
      this.addToast(error.message || "Failed to send invitation", "error");
      throw error;
    }
  }

  // Update member role (uses sendRequest callback)
  async updateMemberRole(
    groupId: string,
    memberId: string,
    role: "admin" | "member",
  ): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<void>("update_member_role", {
        groupId,
        memberId,
        role,
      });
      this.addToast("Member role updated", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to update member role:", error);
      this.addToast(error.message || "Failed to update member role", "error");
      throw error;
    }
  }

  // Remove member from group (uses sendRequest callback)
  async removeMemberFromGroup(
    groupId: string,
    memberId: string,
  ): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<void>("remove_member_from_group", {
        groupId,
        memberId,
      });
      this.addToast("Member removed from group", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to remove member:", error);
      this.addToast(error.message || "Failed to remove member", "error");
      throw error;
    }
  }

  // Fetch group members (implements callback)
  async loadGroupMembers(groupId: string): Promise<GroupMember[]> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<{ members: GroupMember[] }>(
        "get_group_members",
        {
          groupId,
        },
      );
      const members = response.members || [];

      // Normalize displayName as a safety fallback
      // This ensures every member has a valid displayName even if server data is incomplete
      const normalizedMembers = members.map((member) => ({
        ...member,
        displayName:
          member.displayName ||
          (member.usePlayerAsDisplayName ? member.player : member.username) ||
          "Unknown",
      }));

      return normalizedMembers;
    } catch (error: any) {
      console.error("[AppState] Failed to load group members:", error);
      this.addToast(error.message || "Failed to load group members", "error");
      throw error;
    }
  }

  // ==================== Discovery Methods ====================

  // Fetch discoverable groups with pagination, search, and filtering
  async fetchDiscoverableGroups(options?: {
    page?: number;
    perPage?: number;
    search?: string;
    tags?: string[];
    sortBy?: "popular" | "recent" | "name";
    reset?: boolean;
  }): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    const page = options?.page ?? 1;
    const search = options?.search ?? this.discoverSearch;
    const tags = options?.tags ?? this.discoverSelectedTags;
    const sortBy = options?.sortBy ?? this.discoverSortBy;

    // Reset state if requested or first page
    if (options?.reset || page === 1) {
      this.discoverableGroups = [];
    }

    this.discoverLoading = true;

    try {
      const response = await this.sendRequest<{
        groups: DiscoverableGroup[];
        pagination: PaginationMetadata;
      }>("get_discoverable_groups", {
        page,
        perPage: options?.perPage ?? 20,
        search: search || undefined,
        tags: tags.length > 0 ? tags : undefined,
        sortBy,
      });

      if (page === 1 || options?.reset) {
        this.discoverableGroups = response.groups;
      } else {
        // Append for infinite scroll
        this.discoverableGroups = [
          ...this.discoverableGroups,
          ...response.groups,
        ];
      }

      this.discoverPagination = response.pagination;
      this.discoverSearch = search;
      this.discoverSelectedTags = tags;
      this.discoverSortBy = sortBy;
    } catch (error: any) {
      console.error("[AppState] Failed to fetch discoverable groups:", error);
      this.addToast(error.message || "Failed to load groups", "error");
      throw error;
    } finally {
      this.discoverLoading = false;
    }
  }

  // Load more discoverable groups (infinite scroll)
  async loadMoreDiscoverableGroups(): Promise<void> {
    if (this.discoverLoading || !this.discoverPagination.hasMore) {
      return;
    }

    await this.fetchDiscoverableGroups({
      page: this.discoverPagination.page + 1,
    });
  }

  // Fetch available tags for filtering
  async fetchDiscoverTags(): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<{ tags: string[] }>(
        "get_discover_tags",
      );
      this.discoverTags = response.tags;
    } catch (error: any) {
      console.error("[AppState] Failed to fetch discover tags:", error);
      // Non-critical, don't show toast
    }
  }

  // Join an open group instantly
  async joinOpenGroup(groupId: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<{ group: Group }>(
        "join_open_group",
        { groupId },
      );

      // Add the group to the user's groups
      this.addGroup({ ...response.group, members: [] });

      // Update the discoverable group state to show as joined
      this.discoverableGroups = this.discoverableGroups.map((g) =>
        g.id === groupId
          ? { ...g, isJoined: true, memberCount: g.memberCount + 1 }
          : g,
      );

      this.addToast("Joined group successfully", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to join group:", error);
      this.addToast(error.message || "Failed to join group", "error");
      throw error;
    }
  }

  // Request to join a group (requires approval)
  async requestJoinGroup(groupId: string, message?: string): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      await this.sendRequest<{ requestId: string }>("request_join_group", {
        groupId,
        message,
      });

      // Update the discoverable group state to show pending request
      this.discoverableGroups = this.discoverableGroups.map((g) =>
        g.id === groupId ? { ...g, hasPendingRequest: true } : g,
      );

      this.addToast("Join request sent", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to request join:", error);
      this.addToast(error.message || "Failed to send join request", "error");
      throw error;
    }
  }

  // Fetch pending join requests for a group
  async fetchJoinRequests(groupId: string): Promise<GroupJoinRequest[]> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<{ requests: GroupJoinRequest[] }>(
        "get_join_requests",
        { groupId },
      );

      // Cache the requests
      this.pendingJoinRequests.set(groupId, response.requests);

      return response.requests;
    } catch (error: any) {
      console.error("[AppState] Failed to fetch join requests:", error);
      this.addToast(error.message || "Failed to load join requests", "error");
      throw error;
    }
  }

  // Review (accept/deny) a join request
  async reviewJoinRequest(
    requestId: string,
    groupId: string,
    action: "accept" | "deny",
  ): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<{ member?: GroupMember }>(
        "review_join_request",
        {
          requestId,
          decision: action === "accept" ? "approve" : "deny",
        },
      );

      // Remove the request from cache
      const currentRequests = this.pendingJoinRequests.get(groupId) || [];
      this.pendingJoinRequests.set(
        groupId,
        currentRequests.filter((r) => r.id !== requestId),
      );

      // Decrement the group's pendingJoinRequestCount
      const groupIndex = this.groups.findIndex((g) => g.id === groupId);
      if (groupIndex !== -1) {
        const group = this.groups[groupIndex];
        const currentCount = group.pendingJoinRequestCount ?? 0;
        this.groups[groupIndex] = {
          ...group,
          pendingJoinRequestCount: Math.max(0, currentCount - 1),
        };
      }

      // If accepted and we got member data, add to group members
      if (action === "accept" && response.member) {
        const group = this.groups.find((g) => g.id === groupId);
        if (group && group.members) {
          this.updateGroup(groupId, {
            members: [...group.members, response.member],
          });
        }
      }

      this.addToast(
        action === "accept" ? "Join request accepted" : "Join request denied",
        "success",
      );
    } catch (error: any) {
      console.error("[AppState] Failed to review join request:", error);
      this.addToast(error.message || "Failed to process request", "error");
      throw error;
    }
  }

  // Get pending join requests count for a group
  // Uses real-time data from pendingJoinRequests map if available,
  // otherwise falls back to server-provided pendingJoinRequestCount on group
  getJoinRequestCount(groupId: string): number {
    // Check if we have real-time data in the pendingJoinRequests map
    const realtimeRequests = this.pendingJoinRequests.get(groupId);
    if (realtimeRequests !== undefined) {
      return realtimeRequests.length;
    }
    // Fall back to server-provided count from the group object
    const group = this.groups.find((g) => g.id === groupId);
    return group?.pendingJoinRequestCount ?? 0;
  }

  // Clear discovery state (when leaving discover page)
  clearDiscoverState(): void {
    this.discoverableGroups = [];
    this.discoverPagination = {
      page: 1,
      perPage: 20,
      total: 0,
      totalPages: 0,
      hasMore: false,
    };
    this.discoverSearch = "";
    this.discoverSelectedTags = [];
    this.discoverSortBy = "popular";
  }

  // Update group visibility settings (for group owners/admins)
  async updateGroupVisibility(
    groupId: string,
    visibility: GroupVisibility,
    joinMethod?: GroupJoinMethod,
  ): Promise<void> {
    if (!this.sendRequest) {
      throw new Error("WebSocket not initialized");
    }

    try {
      const response = await this.sendRequest<Group>("update_group", {
        groupId,
        visibility,
        joinMethod,
      });

      const existingGroup = this.groups.find((g) => g.id === groupId);
      this.updateGroup(groupId, {
        ...response,
        members: existingGroup?.members || [],
      });

      this.addToast("Group visibility updated", "success");
    } catch (error: any) {
      console.error("[AppState] Failed to update group visibility:", error);
      this.addToast(error.message || "Failed to update visibility", "error");
      throw error;
    }
  }

  // Filter methods - delegate to filterState for backward compatibility
  toggleLogType(eventType: LogEventType) {
    filterState.toggleEventType(eventType);
  }

  enableAllLogTypes() {
    filterState.enableAllEventTypes();
  }

  disableAllLogTypes() {
    filterState.disableAllEventTypes();
  }

  setCombatOnlyFilter() {
    filterState.setCombatOnly();
  }

  togglePlayer(playerName: string) {
    filterState.togglePlayer(playerName);
  }

  enableAllPlayers() {
    filterState.enableAllPlayers();
  }

  disableAllPlayers() {
    filterState.disableAllPlayers();
  }
}

// Export class for testing purposes
export { AppState };

// Export singleton instance
export const appState = new AppState();

// Re-export filterState and constants for use in components
export { filterState, ALL_LOG_TYPES } from "./filterState.svelte.js";
export { COMBAT_LOG_TYPES } from "./filterState.svelte.js";
