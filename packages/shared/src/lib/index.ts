/**
 * @pico/shared - Minimal Export Index
 *
 * After aggressive cleanup: Only exports used by picologs-website
 * Desktop app support removed (pending refactor)
 *
 * Total exports: ~20 items (down from 880+)
 */

// ============================================================================
// Core Components (11 items - used directly by website)
// ============================================================================

export { default as App } from "./components/App.svelte";
export { default as Header } from "./components/Header.svelte";
export { default as Toast } from "./components/Toast.svelte";
export { default as SubNav } from "./components/SubNav.svelte";

// Page Components
export { default as DashboardPage } from "./components/DashboardPage.svelte";
export { default as ProfilePage } from "./components/ProfilePage.svelte";
export { default as FriendsPage } from "./components/FriendsPage.svelte";
export { default as GroupsPage } from "./components/GroupsPage.svelte";
export { default as DiscoverPage } from "./components/DiscoverPage.svelte";
export { default as DiscoverGroupCard } from "./components/DiscoverGroupCard.svelte";

// Auth Components
export { default as AuthDesktop } from "./components/AuthDesktop.svelte";
export { default as AuthDesktopCallback } from "./components/AuthDesktopCallback.svelte";
export { default as DiscordIcon } from "./components/DiscordIcon.svelte";

// Legal Components
export { default as LandingPage } from "./components/LandingPage.svelte";
export { default as PrivacyPolicy } from "./components/PrivacyPolicy.svelte";
export { default as TermsOfService } from "./components/TermsOfService.svelte";

// ============================================================================
// Internal Components (used by exported components)
// ============================================================================

// These are NOT used directly by website, but required by components above
export { default as Avatar } from "./components/Avatar.svelte";
export { default as Dialog } from "./components/Dialog.svelte";
export { default as GettingStartedDialog } from "./components/GettingStartedDialog.svelte";
export { default as LogFeed } from "./components/LogFeed.svelte";
export { default as SidePanel } from "./components/SidePanel.svelte";
export { default as FooterBar } from "./components/FooterBar.svelte";
export { default as Resizer } from "./components/Resizer.svelte";
export { default as SidePanelGroups } from "./components/SidePanelGroups.svelte";
export { default as GroupItem } from "./components/GroupItem.svelte";
export { default as LogItem } from "./components/LogItem.svelte";
export { default as EmptyState } from "./components/EmptyState.svelte";
export { default as LoadingOverlay } from "./components/LoadingOverlay.svelte";

// Log feed sub-components
export {
  LogList,
  LogItemIcon,
  LogItemContent,
  LogItemText,
  LogItemMetadata,
  LogItemDetails,
  LogItemCopyButton,
  ShipIcon,
} from "./components/log-feed/index.js";
export { default as PlayerFilter } from "./components/log-feed/PlayerFilter.svelte";

// ============================================================================
// State Management
// ============================================================================

export { appState } from "./app.svelte.js";
export type { ConnectionStatus } from "./app.svelte.js";

// Filter State (single source of truth for all filtering)
export {
  filterState,
  ALL_LOG_TYPES,
  COMBAT_LOG_TYPES,
  FilterState,
} from "./filterState.svelte.js";

// ============================================================================
// Utilities (minimal - only what components need)
// ============================================================================

export { getDisplayName } from "./utils/display-name.js";
export { updateFriendOnlineStatus } from "./utils/composables-utils.js";
export { useEmptyStateMessage } from "./utils/useEmptyStateMessage.svelte.js";
export type { EmptyStateMessageOptions } from "./utils/useEmptyStateMessage.svelte.js";

// ============================================================================
// Log Parsing Utilities (Desktop App Support)
// ============================================================================

// Log Parser
export {
  parseStarCitizenLogLine,
  parseLogLines,
  parseLogTimestamp,
  extractPlayerName,
  detectEnvironment,
  resetParserState,
  getCurrentPlayer,
  setCurrentPlayer,
  formatMissionObjectiveState,
} from "./utils/log-parser.js";

// Log ID Generation
export { generateId } from "./utils/log-id.js";

// Log Grouping
export {
  groupEquipmentEvents,
  groupInsuranceEvents,
  groupCrashDeathEvents,
  groupCrossPlayerEvents,
  flattenGroups,
  processAllGroupings,
  getEventSignature,
  CROSS_PLAYER_OBSERVABLE_EVENTS,
} from "./utils/log-grouping.js";

// Log Utilities
export {
  dedupeAndSortLogs,
  groupKillingSprees,
  applyMemoryLimit,
  processAndLimitLogs,
  filterLogsByUser,
  filterLogsByUsers,
  filterLogsSince,
  filterLogsByTimeRange,
  filterLogsByEventType,
  filterLogsByPlayers,
  extractPlayersFromLog,
  getAllPlayersFromLogs,
  getMostRecentLog,
  getLastSyncTimestamp,
  mergeLogs,
  countLogsByEventType,
  getUniquePlayers,
  isNPCLog,
  isAIEntity,
  filterOutNPCLogs,
  calculateSessionStats,
} from "./utils/log-utils.js";

export type { SessionStatsData } from "./utils/log-utils.js";

// Log Batch Management
export {
  LogBatchManager,
  MultiTargetBatchManager,
  LogSyncManager,
  shouldCompressLogs,
  calculateLogSize,
  COMPRESSION_THRESHOLD_BYTES,
  COMPRESSION_THRESHOLD_LOGS,
  DEFAULT_BATCH_INTERVAL_MS,
  DEFAULT_BATCH_SIZE,
} from "./utils/log-batch.js";

// Log Schema Cache (Svelte 5 runes - desktop app only)
// Pattern extraction happens in Rust, TypeScript only handles batching and sending
export {
  getPatternCache,
  initPatternCache,
  destroyPatternCache,
  addPattern,
  addPatterns,
  flushPatterns,
  getPatternCacheStats,
  hasSeenPattern,
  getLocalCount,
  resetPatternCache,
  setBetaTesterEnabled,
} from "./utils/log-schema-cache.svelte.js";
export type { PatternReportCallback } from "./utils/log-schema-cache.svelte.js";

// ============================================================================
// Types (Re-export from @pico/types and components)
// ============================================================================

// Log types
export type { Log, LogTransmit, RecentEvent, LogLine } from "@pico/types";
export { toLogTransmit, fromLogTransmit } from "@pico/types";

// User types (re-export from @pico/types for convenience)
export type { UserProfile, ProfileUpdateData } from "@pico/types";

// Component types
export type { ToastNotification } from "./components/Toast.svelte";
export type { GroupItemData } from "./components/GroupItem.svelte";
export type { GroupMember as GroupItemMember } from "@pico/types";

// Database types (re-exported for compatibility)
export type {
  DBUser,
  DBNewUser,
  DBGroup,
  DBNewGroup,
  DBGroupMember,
  DBNewGroupMember,
  DBFriend,
  DBNewFriend,
  DBGroupInvitation,
  DBNewGroupInvitation,
  DBNotification,
  DBNewNotification,
} from "@pico/types";

// Database schema
export {
  users,
  groups,
  groupMembers,
  groupInvitations,
  friends,
  notifications,
  usersRelations,
  groupsRelations,
  groupMembersRelations,
  friendsRelations,
  groupInvitationsRelations,
  notificationsRelations,
} from "@pico/types";

// ============================================================================
// Server Exports (kept untouched - website needs these)
// ============================================================================
// Note: Server exports remain in './server' export path
// Import from '@pico/shared/server'
