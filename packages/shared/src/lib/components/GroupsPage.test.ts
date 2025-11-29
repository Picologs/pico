/**
 * Tests for GroupsPage.svelte
 *
 * Tests the component logic including:
 * - Member sorting (by role, online status, name)
 * - Role-based permissions
 * - Group filtering and sorting
 * - Invitation handling
 * - Delete confirmation validation
 */

import { describe, it, expect } from "vitest";
import {
  createTestGroup,
  createTestGroups,
  createOwnedGroup,
  createAdminGroup,
  createDiscoverableGroup,
  createTestGroupMember,
  createTestGroupMembers,
  createTestGroupInvitation,
  createTestFriend,
  createTestFriends,
} from "../test-utils";
import type { Group, GroupMember, GroupInvitation, Friend } from "@pico/types";

// ============================================================================
// Helper function tests (extracted from GroupsPage.svelte)
// ============================================================================

/**
 * Sort groups alphabetically by name
 */
function sortGroupsAlphabetically(groups: Group[]): Group[] {
  return [...groups]
    .filter((g) => g && g.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sort members by role, then online status, then name
 * Role order: owner > admin > member
 */
function getSortedMembers(members: GroupMember[]): GroupMember[] {
  if (!Array.isArray(members)) {
    return [];
  }

  return [...members].sort((a, b) => {
    // Owner first, then admins, then members
    const roleOrder = { owner: 0, admin: 1, member: 2 };
    const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
    const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;

    // Online members first
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;

    // Then sort by name
    const aName = a.displayName || "Unknown";
    const bName = b.displayName || "Unknown";
    return aName.localeCompare(bName);
  });
}

/**
 * Filter pending invitations
 */
function filterPendingInvitations(
  invitations: GroupInvitation[],
): GroupInvitation[] {
  return invitations.filter((inv) => inv.status === "pending");
}

/**
 * Get friends not in a group (for invite dialog)
 */
function getFriendsNotInGroup(
  friends: Friend[],
  members: GroupMember[],
): Friend[] {
  const memberIds = new Set(members.map((m) => m.userId));
  return friends.filter((f) => !memberIds.has(f.id) && f.status === "accepted");
}

/**
 * Filter friends by search query
 */
function filterFriendsBySearch(friends: Friend[], query: string): Friend[] {
  if (!query.trim()) return friends;

  const lowerQuery = query.toLowerCase();
  return friends.filter((f) => {
    const displayName = f.friendDisplayName || f.friendUsername || "";
    return displayName.toLowerCase().includes(lowerQuery);
  });
}

/**
 * Check if user can manage group (owner or admin)
 */
function canManageGroup(memberRole: string): boolean {
  return memberRole === "owner" || memberRole === "admin";
}

/**
 * Check if user can edit group settings (owner only)
 */
function canEditGroup(memberRole: string): boolean {
  return memberRole === "owner";
}

/**
 * Check if avatar is an uploaded image
 */
function isUploadedImage(avatar: string | null | undefined): boolean {
  return avatar?.startsWith("http") || avatar?.startsWith("/uploads") || false;
}

/**
 * Validate delete confirmation text
 */
function isDeleteValid(confirmation: string): boolean {
  return confirmation === "DELETE";
}

// ============================================================================
// Group Sorting Tests
// ============================================================================

describe("GroupsPage - Group Sorting", () => {
  it("should sort groups alphabetically by name", () => {
    const groups = [
      createTestGroup({ id: "1", name: "Zulu Group" }),
      createTestGroup({ id: "2", name: "Alpha Group" }),
      createTestGroup({ id: "3", name: "Mike Group" }),
    ];

    const sorted = sortGroupsAlphabetically(groups);

    expect(sorted[0].name).toBe("Alpha Group");
    expect(sorted[1].name).toBe("Mike Group");
    expect(sorted[2].name).toBe("Zulu Group");
  });

  it("should filter out invalid groups", () => {
    const groups = [
      createTestGroup({ id: "1", name: "Valid Group" }),
      { name: "No ID" } as unknown as Group,
      createTestGroup({ id: "2", name: "Another Valid" }),
    ];

    const sorted = sortGroupsAlphabetically(groups);

    expect(sorted).toHaveLength(2);
  });

  it("should handle empty groups array", () => {
    const sorted = sortGroupsAlphabetically([]);
    expect(sorted).toHaveLength(0);
  });
});

// ============================================================================
// Member Sorting Tests
// ============================================================================

describe("GroupsPage - Member Sorting", () => {
  it("should sort members by role: owner first, then admin, then member", () => {
    const members = [
      createTestGroupMember({
        userId: "1",
        role: "member",
        displayName: "Member",
      }),
      createTestGroupMember({
        userId: "2",
        role: "owner",
        displayName: "Owner",
      }),
      createTestGroupMember({
        userId: "3",
        role: "admin",
        displayName: "Admin",
      }),
    ];

    const sorted = getSortedMembers(members);

    expect(sorted[0].role).toBe("owner");
    expect(sorted[1].role).toBe("admin");
    expect(sorted[2].role).toBe("member");
  });

  it("should sort online members before offline within same role", () => {
    const members = [
      createTestGroupMember({
        userId: "1",
        role: "member",
        isOnline: false,
        displayName: "A",
      }),
      createTestGroupMember({
        userId: "2",
        role: "member",
        isOnline: true,
        displayName: "B",
      }),
      createTestGroupMember({
        userId: "3",
        role: "member",
        isOnline: false,
        displayName: "C",
      }),
    ];

    const sorted = getSortedMembers(members);

    expect(sorted[0].isOnline).toBe(true);
    expect(sorted[1].isOnline).toBe(false);
    expect(sorted[2].isOnline).toBe(false);
  });

  it("should sort alphabetically within same role and online status", () => {
    const members = [
      createTestGroupMember({
        userId: "1",
        role: "member",
        isOnline: false,
        displayName: "Zack",
      }),
      createTestGroupMember({
        userId: "2",
        role: "member",
        isOnline: false,
        displayName: "Alice",
      }),
      createTestGroupMember({
        userId: "3",
        role: "member",
        isOnline: false,
        displayName: "Bob",
      }),
    ];

    const sorted = getSortedMembers(members);

    expect(sorted[0].displayName).toBe("Alice");
    expect(sorted[1].displayName).toBe("Bob");
    expect(sorted[2].displayName).toBe("Zack");
  });

  it("should handle members with no display name", () => {
    const members = [
      createTestGroupMember({ userId: "1", role: "member", displayName: "" }),
      createTestGroupMember({
        userId: "2",
        role: "member",
        displayName: "Alice",
      }),
    ];

    const sorted = getSortedMembers(members);

    // 'Unknown' should sort after 'Alice'
    expect(sorted[0].displayName).toBe("Alice");
    expect(sorted[1].displayName).toBe("");
  });

  it("should return empty array for invalid input", () => {
    const sorted = getSortedMembers(null as unknown as GroupMember[]);
    expect(sorted).toHaveLength(0);
  });

  it("should handle empty members array", () => {
    const sorted = getSortedMembers([]);
    expect(sorted).toHaveLength(0);
  });
});

// ============================================================================
// Role Permission Tests
// ============================================================================

describe("GroupsPage - Role Permissions", () => {
  it("should allow owner to manage group", () => {
    expect(canManageGroup("owner")).toBe(true);
  });

  it("should allow admin to manage group", () => {
    expect(canManageGroup("admin")).toBe(true);
  });

  it("should not allow member to manage group", () => {
    expect(canManageGroup("member")).toBe(false);
  });

  it("should only allow owner to edit group settings", () => {
    expect(canEditGroup("owner")).toBe(true);
    expect(canEditGroup("admin")).toBe(false);
    expect(canEditGroup("member")).toBe(false);
  });

  it("should identify owner group correctly", () => {
    const group = createOwnedGroup();
    expect(group.memberRole).toBe("owner");
    expect(canManageGroup(group.memberRole)).toBe(true);
    expect(canEditGroup(group.memberRole)).toBe(true);
  });

  it("should identify admin group correctly", () => {
    const group = createAdminGroup();
    expect(group.memberRole).toBe("admin");
    expect(canManageGroup(group.memberRole)).toBe(true);
    expect(canEditGroup(group.memberRole)).toBe(false);
  });
});

// ============================================================================
// Invitation Tests
// ============================================================================

describe("GroupsPage - Invitations", () => {
  it("should filter pending invitations", () => {
    const invitations = [
      createTestGroupInvitation({ id: "1", status: "pending" }),
      createTestGroupInvitation({ id: "2", status: "accepted" }),
      createTestGroupInvitation({ id: "3", status: "pending" }),
      createTestGroupInvitation({ id: "4", status: "denied" }),
    ];

    const pending = filterPendingInvitations(invitations);

    expect(pending).toHaveLength(2);
    expect(pending.every((inv) => inv.status === "pending")).toBe(true);
  });

  it("should count pending invitations correctly", () => {
    const invitations = [
      createTestGroupInvitation({ id: "1", status: "pending" }),
      createTestGroupInvitation({ id: "2", status: "pending" }),
      createTestGroupInvitation({ id: "3", status: "pending" }),
    ];

    const pending = filterPendingInvitations(invitations);
    expect(pending.length).toBe(3);
  });

  it("should handle no pending invitations", () => {
    const invitations = [
      createTestGroupInvitation({ id: "1", status: "accepted" }),
      createTestGroupInvitation({ id: "2", status: "denied" }),
    ];

    const pending = filterPendingInvitations(invitations);
    expect(pending).toHaveLength(0);
  });
});

// ============================================================================
// Friend Invite Dialog Tests
// ============================================================================

describe("GroupsPage - Friend Invite Logic", () => {
  it("should filter out friends already in group", () => {
    const friends = createTestFriends(5, { status: "accepted" });
    const members = [
      createTestGroupMember({ userId: friends[0].id }),
      createTestGroupMember({ userId: friends[2].id }),
    ];

    const available = getFriendsNotInGroup(friends, members);

    expect(available).toHaveLength(3);
    expect(available.some((f) => f.id === friends[0].id)).toBe(false);
    expect(available.some((f) => f.id === friends[2].id)).toBe(false);
  });

  it("should filter out non-accepted friends", () => {
    const friends = [
      createTestFriend({ id: "1", status: "accepted" }),
      createTestFriend({ id: "2", status: "pending" }),
      createTestFriend({ id: "3", status: "accepted" }),
    ];

    const available = getFriendsNotInGroup(friends, []);

    expect(available).toHaveLength(2);
  });

  it("should filter friends by search query", () => {
    const friends = [
      createTestFriend({
        id: "1",
        friendDisplayName: "Alice Johnson",
        friendUsername: "alice",
      }),
      createTestFriend({
        id: "2",
        friendDisplayName: "Bob Smith",
        friendUsername: "bob",
      }),
      createTestFriend({
        id: "3",
        friendDisplayName: "Alice Brown",
        friendUsername: "alice2",
      }),
    ];

    const filtered = filterFriendsBySearch(friends, "alice");

    expect(filtered).toHaveLength(2);
    expect(
      filtered.every((f) =>
        f.friendDisplayName?.toLowerCase().includes("alice"),
      ),
    ).toBe(true);
  });

  it("should return all friends when search query is empty", () => {
    const friends = createTestFriends(5);

    const filtered = filterFriendsBySearch(friends, "");
    expect(filtered).toHaveLength(5);

    const filteredWithSpaces = filterFriendsBySearch(friends, "   ");
    expect(filteredWithSpaces).toHaveLength(5);
  });

  it("should be case-insensitive in search", () => {
    const friends = [
      createTestFriend({
        id: "1",
        friendDisplayName: "ALICE",
        friendUsername: "alice",
      }),
    ];

    expect(filterFriendsBySearch(friends, "alice")).toHaveLength(1);
    expect(filterFriendsBySearch(friends, "ALICE")).toHaveLength(1);
    expect(filterFriendsBySearch(friends, "Alice")).toHaveLength(1);
  });
});

// ============================================================================
// Delete Confirmation Tests
// ============================================================================

describe("GroupsPage - Delete Confirmation", () => {
  it("should validate DELETE confirmation", () => {
    expect(isDeleteValid("DELETE")).toBe(true);
  });

  it("should reject lowercase delete", () => {
    expect(isDeleteValid("delete")).toBe(false);
  });

  it("should reject partial match", () => {
    expect(isDeleteValid("DELET")).toBe(false);
    expect(isDeleteValid("DELETEE")).toBe(false);
  });

  it("should reject empty string", () => {
    expect(isDeleteValid("")).toBe(false);
  });

  it("should reject whitespace", () => {
    expect(isDeleteValid(" DELETE ")).toBe(false);
    expect(isDeleteValid("DELETE ")).toBe(false);
  });
});

// ============================================================================
// Avatar Detection Tests
// ============================================================================

describe("GroupsPage - Avatar Detection", () => {
  it("should detect http URLs as uploaded images", () => {
    expect(isUploadedImage("https://example.com/image.png")).toBe(true);
    expect(isUploadedImage("http://example.com/image.png")).toBe(true);
  });

  it("should detect /uploads paths as uploaded images", () => {
    expect(isUploadedImage("/uploads/avatar.png")).toBe(true);
    expect(isUploadedImage("/uploads/group/image.jpg")).toBe(true);
  });

  it("should not detect emoji as uploaded images", () => {
    expect(isUploadedImage("🚀")).toBe(false);
    expect(isUploadedImage("🎮")).toBe(false);
  });

  it("should handle null and undefined", () => {
    expect(isUploadedImage(null)).toBe(false);
    expect(isUploadedImage(undefined)).toBe(false);
  });

  it("should handle empty string", () => {
    expect(isUploadedImage("")).toBe(false);
  });
});

// ============================================================================
// Group Visibility Tests
// ============================================================================

describe("GroupsPage - Group Visibility", () => {
  it("should identify private groups", () => {
    const group = createTestGroup({ visibility: "private" });
    expect(group.visibility).toBe("private");
  });

  it("should identify discoverable groups", () => {
    const group = createDiscoverableGroup();
    expect(group.visibility).toBe("discoverable");
  });

  it("should have correct join method for discoverable groups", () => {
    const openGroup = createDiscoverableGroup({ joinMethod: "open" });
    expect(openGroup.joinMethod).toBe("open");

    const requestGroup = createDiscoverableGroup({ joinMethod: "request" });
    expect(requestGroup.joinMethod).toBe("request");
  });
});

// ============================================================================
// Group Member Count Tests
// ============================================================================

describe("GroupsPage - Member Count Display", () => {
  it("should handle singular member", () => {
    const group = createTestGroup({ memberCount: 1 });
    const memberText =
      group.memberCount === 1
        ? `${group.memberCount} member`
        : `${group.memberCount} members`;
    expect(memberText).toBe("1 member");
  });

  it("should handle multiple members", () => {
    const group = createTestGroup({ memberCount: 5 });
    const memberText =
      group.memberCount === 1
        ? `${group.memberCount} member`
        : `${group.memberCount} members`;
    expect(memberText).toBe("5 members");
  });

  it("should handle zero members", () => {
    const group = createTestGroup({ memberCount: 0 });
    const memberText =
      group.memberCount === 1
        ? `${group.memberCount} member`
        : `${group.memberCount} members`;
    expect(memberText).toBe("0 members");
  });
});

// ============================================================================
// Tag Display Tests
// ============================================================================

describe("GroupsPage - Tags Display", () => {
  it("should display group tags", () => {
    const group = createTestGroup({ tags: ["pve", "trading", "exploration"] });
    expect(group.tags).toHaveLength(3);
    expect(group.tags).toContain("pve");
    expect(group.tags).toContain("trading");
    expect(group.tags).toContain("exploration");
  });

  it("should handle empty tags array", () => {
    const group = createTestGroup({ tags: [] });
    expect(group.tags).toHaveLength(0);
  });

  it("should handle groups without tags", () => {
    // Tags is required in our fixture but test the display logic
    const group = createTestGroup({ tags: [] });
    const hasTags = group.tags && group.tags.length > 0;
    expect(hasTags).toBe(false);
  });
});
