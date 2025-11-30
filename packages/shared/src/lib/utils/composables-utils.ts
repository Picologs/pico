/**
 * Composable Utilities - Phase 1 Extraction
 *
 * Pure utility functions shared between useWebLayout and useTauriLayout.
 * These functions have no side effects and no external dependencies.
 *
 * @module composables-utils
 */

import type { Friend, GroupMember } from "@pico/types";

/**
 * Transform API friend response into UI Friend format.
 *
 * Converts the backend API friend structure into the standardized Friend type
 * used across the application. Handles name fallback (displayName -> username)
 * and timezone defaulting.
 *
 * @param friend - Raw friend data from API response
 * @returns Transformed Friend object with UI-ready properties
 *
 * @example
 * const apiFriend = {
 *   friendUserId: '123',
 *   friendDiscordId: '456',
 *   friendDisplayName: 'JohnDoe',
 *   friendUsername: 'john',
 *   friendAvatar: 'avatar.png',
 *   friendTimeZone: 'America/New_York'
 * };
 * const friend = transformFriendFromAPI(apiFriend);
 * // Returns: { id: '123', discordId: '456', name: 'JohnDoe', ... }
 */
export function transformFriendFromAPI(friend: any): Friend {
  return {
    id: friend.id,
    status: friend.status || "accepted",
    createdAt: friend.createdAt || new Date().toISOString(),
    friendUserId: friend.friendUserId,
    friendDiscordId: friend.friendDiscordId,
    friendUsername: friend.friendUsername,
    friendDisplayName: friend.friendDisplayName || friend.friendUsername,
    friendAvatar: friend.friendAvatar,
    friendPlayer: friend.friendPlayer || null,
    friendTimeZone: friend.friendTimeZone || null,
    friendUsePlayerAsDisplayName: friend.friendUsePlayerAsDisplayName || false,
    friendCode: friend.friendCode || null,
    isOnline: false,
    isConnected: false,
  };
}

/**
 * Immutably update a friend's online status in the friends list.
 *
 * Creates a new array with the updated friend status without mutating the original.
 * If the friend is not found, returns the original list unchanged.
 *
 * @param friendsList - Current list of friends
 * @param friendDiscordId - Discord ID of the friend to update
 * @param isOnline - New online status
 * @returns New friends list with updated status, or original list if friend not found
 *
 * @example
 * const friends = [{ friendDiscordId: '123456789', friendUsername: 'John', isOnline: false, ... }];
 * const updated = updateFriendOnlineStatus(friends, '123456789', true);
 * // Returns new array with John's isOnline = true
 */
export function updateFriendOnlineStatus(
  friendsList: Friend[],
  friendDiscordId: string,
  isOnline: boolean,
): Friend[] {
  const index = friendsList.findIndex(
    (f) => f.friendDiscordId === friendDiscordId,
  );
  if (index === -1) return friendsList;

  return [
    ...friendsList.slice(0, index),
    { ...friendsList[index], isOnline },
    ...friendsList.slice(index + 1),
  ];
}

/**
 * Immutably update a group member's online status in the group members map.
 *
 * Creates a new Map with the updated member status without mutating the original.
 * Updates both `isOnline` and `isConnected` properties to keep them in sync.
 * If the group or member is not found, returns the original map unchanged.
 *
 * @param groupMembers - Current map of group IDs to member lists
 * @param groupId - ID of the group containing the member
 * @param discordId - Discord ID of the member to update
 * @param isOnline - New online status
 * @returns New group members map with updated status, or original map if not found
 *
 * @example
 * const members = new SvelteMap([
 *   ['group1', [{ discordId: '456', name: 'John', isOnline: false, ... }]]
 * ]);
 * const updated = updateGroupMemberOnlineStatus(members, 'group1', '456', true);
 * // Returns new Map with John's isOnline and isConnected = true
 */
export function updateGroupMemberOnlineStatus(
  groupMembers: Map<string, GroupMember[]>,
  groupId: string,
  discordId: string,
  isOnline: boolean,
): Map<string, GroupMember[]> {
  const members = groupMembers.get(groupId);
  if (!members) return groupMembers;

  const memberIndex = members.findIndex((m) => m.discordId === discordId);
  if (memberIndex === -1) return groupMembers;

  const updatedMember = {
    ...members[memberIndex],
    isOnline,
    isConnected: isOnline,
  };
  const updatedMembers = [
    ...members.slice(0, memberIndex),
    updatedMember,
    ...members.slice(memberIndex + 1),
  ];

  const newMap = new Map(groupMembers);
  newMap.set(groupId, updatedMembers);
  return newMap;
}

/**
 * Copy text to the system clipboard.
 *
 * Uses the modern Clipboard API to copy text. Throws an error if the operation fails,
 * which should be caught by the caller for proper error handling.
 *
 * @param text - Text content to copy to clipboard
 * @returns Promise that resolves when copy is complete
 * @throws Error if clipboard write fails (e.g., permissions denied)
 *
 * @example
 * try {
 *   await copyTextToClipboard('Hello, world!');
 *   console.log('Copied successfully');
 * } catch (error) {
 *   console.error('Failed to copy:', error);
 * }
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
