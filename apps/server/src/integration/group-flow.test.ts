/**
 * Group Flow Integration Tests
 *
 * Tests the complete group lifecycle:
 * - Creating groups
 * - Inviting members
 * - Accepting/denying invitations
 * - Role management
 * - Leaving groups
 * - Group discovery (public groups)
 *
 * @module server/integration/group-flow.test
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { withNeonTestBranch } from "../test/setup";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  leaveGroup,
  inviteFriendToGroup,
  acceptGroupInvitation,
  denyGroupInvitation,
  getGroupInvitations,
  getGroupMembers,
  updateMemberRole,
  removeMemberFromGroup,
} from "../handlers/groups";
import { broadcast } from "../lib/utils";
import { db, groupInvitations, groupMembers } from "../lib/db";
import { eq } from "drizzle-orm";
import {
  MockWebSocket,
  clearConnectionState,
  simulateConnection,
  seedTestUser,
  seedTestGroup,
  seedFriendship,
  seedGroupMember,
  cleanupTestData,
  testUUID,
} from "./test-utils";

describe("Group Flow Integration Tests", () => {
  // Set up ephemeral Neon database branch for this test suite
  withNeonTestBranch();

  beforeEach(() => {
    clearConnectionState();
  });

  afterEach(async () => {
    clearConnectionState();
    await cleanupTestData();
  });

  // ============================================================================
  // Get Groups Tests
  // ============================================================================

  describe("getGroups", () => {
    test("should return empty list for user with no groups", async () => {
      const user = await seedTestUser();
      const ws = new MockWebSocket();

      await getGroups(ws, user.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("groups_list");
      // getGroups returns { groups: [] }
      expect(response.data.groups).toEqual([]);
    });

    test("should return groups where user is a member", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        name: "Test Squadron",
      });
      await seedGroupMember(group.id, member.id, "member");

      const ws = new MockWebSocket();
      await getGroups(ws, member.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("groups_list");
      // getGroups returns { groups: [...] }
      expect(response.data.groups.length).toBe(1);
      expect(response.data.groups[0].name).toBe("Test Squadron");
      expect(response.data.groups[0].memberRole).toBe("member");
    });

    test("should return owner role for group creator", async () => {
      const owner = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });

      const ws = new MockWebSocket();
      await getGroups(ws, owner.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.groups[0].memberRole).toBe("owner");
    });

    test("should include member count", async () => {
      const owner = await seedTestUser();
      const member1 = await seedTestUser();
      const member2 = await seedTestUser();

      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, member1.id, "member");
      await seedGroupMember(group.id, member2.id, "member");

      const ws = new MockWebSocket();
      await getGroups(ws, owner.discordId, {}, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.groups[0].memberCount).toBe(3); // owner + 2 members
    });
  });

  // ============================================================================
  // Create Group Tests
  // ============================================================================

  describe("createGroup", () => {
    test("should create a new group", async () => {
      const owner = await seedTestUser();
      const ws = new MockWebSocket();

      await createGroup(
        ws,
        owner.discordId,
        {
          name: "New Squadron",
          description: "A test squadron",
          tags: ["gaming", "sc"],
        },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("group_created");
      // createGroup returns { group: {...} }
      expect(response.data.group.name).toBe("New Squadron");
      expect(response.data.group.description).toBe("A test squadron");
      expect(response.data.group.memberRole).toBe("owner");
    });

    test("should require group name", async () => {
      const owner = await seedTestUser();
      const ws = new MockWebSocket();

      await createGroup(
        ws,
        owner.discordId,
        { description: "No name" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("name");
    });

    test("should create group with visibility settings", async () => {
      const owner = await seedTestUser();
      const ws = new MockWebSocket();

      await createGroup(
        ws,
        owner.discordId,
        {
          name: "Public Group",
          visibility: "discoverable",
          joinMethod: "open",
        },
        "req-1",
      );

      const response = ws.getLastMessage();
      // createGroup sends 'group_created' with { group: {...} }
      expect(response.type).toBe("group_created");
      expect(response.data.group.visibility).toBe("discoverable");
      expect(response.data.group.joinMethod).toBe("open");
    });
  });

  // ============================================================================
  // Update Group Tests
  // ============================================================================

  describe("updateGroup", () => {
    test("should allow owner to update group", async () => {
      const owner = await seedTestUser();
      const group = await seedTestGroup({
        ownerId: owner.id,
        name: "Original Name",
      });

      const ws = new MockWebSocket();
      await updateGroup(
        ws,
        owner.discordId,
        {
          groupId: group.id,
          name: "Updated Name",
          description: "New description",
        },
        "req-1",
      );

      const response = ws.getLastMessage();
      // updateGroup sends 'response' with updated group data to caller, broadcasts 'group_updated'
      expect(response.type).toBe("response");
      expect(response.data.name).toBe("Updated Name");
    });

    test("should allow admin to update group", async () => {
      const owner = await seedTestUser();
      const admin = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, admin.id, "admin");

      const ws = new MockWebSocket();
      await updateGroup(
        ws,
        admin.discordId,
        {
          groupId: group.id,
          description: "Admin updated this",
        },
        "req-1",
      );

      const response = ws.getLastMessage();
      // updateGroup sends 'response' to caller
      expect(response.type).toBe("response");
    });

    test("should reject member from updating group", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, member.id, "member");

      const ws = new MockWebSocket();
      await updateGroup(
        ws,
        member.discordId,
        {
          groupId: group.id,
          name: "Hacked Name",
        },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("permission");
    });
  });

  // ============================================================================
  // Delete Group Tests
  // ============================================================================

  describe("deleteGroup", () => {
    test("should allow owner to delete group", async () => {
      const owner = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });

      const ws = new MockWebSocket();
      await deleteGroup(ws, owner.discordId, { groupId: group.id }, "req-1");

      const response = ws.getLastMessage();
      // deleteGroup sends 'response' to caller, broadcasts 'group_deleted'
      expect(response.type).toBe("response");
      expect(response.data.success).toBe(true);
    });

    test("should reject non-owner from deleting group", async () => {
      const owner = await seedTestUser();
      const admin = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, admin.id, "admin");

      const ws = new MockWebSocket();
      await deleteGroup(ws, admin.discordId, { groupId: group.id }, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
    });

    test("should notify members when group is deleted", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, member.id, "member");

      const { ws: memberWs } = simulateConnection(member.discordId);
      const ws = new MockWebSocket();

      await deleteGroup(ws, owner.discordId, { groupId: group.id }, "req-1");

      expect(memberWs.hasMessage("group_deleted")).toBe(true);
    });
  });

  // ============================================================================
  // Leave Group Tests
  // ============================================================================

  describe("leaveGroup", () => {
    test("should allow member to leave group", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, member.id, "member");

      const ws = new MockWebSocket();
      await leaveGroup(ws, member.discordId, { groupId: group.id }, "req-1");

      const response = ws.getLastMessage();
      // Handler sends 'response' to caller, then broadcasts 'member_left_group'
      expect(response.type).toBe("response");
      expect(response.data.success).toBe(true);
    });

    test("should reject owner from leaving group", async () => {
      const owner = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });

      const ws = new MockWebSocket();
      await leaveGroup(ws, owner.discordId, { groupId: group.id }, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("owner");
    });

    test("should notify other members when someone leaves", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      const otherMember = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, member.id, "member");
      await seedGroupMember(group.id, otherMember.id, "member");

      const { ws: ownerWs } = simulateConnection(owner.discordId);
      const { ws: otherWs } = simulateConnection(otherMember.discordId);
      const ws = new MockWebSocket();

      await leaveGroup(ws, member.discordId, { groupId: group.id }, "req-1");

      expect(ownerWs.hasMessage("member_left_group")).toBe(true);
      expect(otherWs.hasMessage("member_left_group")).toBe(true);
    });
  });

  // ============================================================================
  // Invite to Group Tests
  // ============================================================================

  describe("inviteFriendToGroup", () => {
    test("should invite friend to group", async () => {
      const owner = await seedTestUser();
      const friend = await seedTestUser();
      await seedFriendship(owner.id, friend.id, "accepted");
      const group = await seedTestGroup({ ownerId: owner.id });

      const { ws: friendWs } = simulateConnection(friend.discordId);
      const ws = new MockWebSocket();

      await inviteFriendToGroup(
        ws,
        owner.discordId,
        { groupId: group.id, friendDiscordId: friend.discordId },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("group_invitation_sent");

      // Friend should receive invitation
      expect(friendWs.hasMessage("group_invitation_received")).toBe(true);
    });

    test("should allow invitation to any valid user (no friendship required)", async () => {
      // Note: The handler doesn't require friendship - anyone can be invited
      const owner = await seedTestUser();
      const stranger = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });

      const { ws: strangerWs } = simulateConnection(stranger.discordId);
      const ws = new MockWebSocket();

      await inviteFriendToGroup(
        ws,
        owner.discordId,
        { groupId: group.id, friendDiscordId: stranger.discordId },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("group_invitation_sent");

      // User should receive the invitation
      expect(strangerWs.hasMessage("group_invitation_received")).toBe(true);
    });

    test("should reject invitation if user already member", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      await seedFriendship(owner.id, member.id, "accepted");
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, member.id, "member");

      const ws = new MockWebSocket();

      await inviteFriendToGroup(
        ws,
        owner.discordId,
        { groupId: group.id, friendDiscordId: member.discordId },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("already");
    });
  });

  // ============================================================================
  // Accept Group Invitation Tests
  // ============================================================================

  describe("acceptGroupInvitation", () => {
    test("should accept pending invitation", async () => {
      const owner = await seedTestUser();
      const invitee = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });

      // Create invitation
      const [invitation] = await db
        .insert(groupInvitations)
        .values({
          groupId: group.id,
          inviterId: owner.id,
          inviteeId: invitee.id,
          status: "pending",
        })
        .returning();

      const { ws: ownerWs } = simulateConnection(owner.discordId);
      const ws = new MockWebSocket();

      await acceptGroupInvitation(
        ws,
        invitee.discordId,
        { invitationId: invitation.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("group_invitation_accepted");

      // Owner should be notified
      expect(ownerWs.hasMessage("member_joined_group")).toBe(true);
    });
  });

  // ============================================================================
  // Deny Group Invitation Tests
  // ============================================================================

  describe("denyGroupInvitation", () => {
    test("should deny pending invitation", async () => {
      const owner = await seedTestUser();
      const invitee = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });

      const [invitation] = await db
        .insert(groupInvitations)
        .values({
          groupId: group.id,
          inviterId: owner.id,
          inviteeId: invitee.id,
          status: "pending",
        })
        .returning();

      const ws = new MockWebSocket();

      await denyGroupInvitation(
        ws,
        invitee.discordId,
        { invitationId: invitation.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("group_invitation_denied");
    });
  });

  // ============================================================================
  // Get Group Members Tests
  // ============================================================================

  describe("getGroupMembers", () => {
    test("should return all members with roles", async () => {
      const owner = await seedTestUser({ username: "owner-user" });
      const admin = await seedTestUser({ username: "admin-user" });
      const member = await seedTestUser({ username: "member-user" });
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, admin.id, "admin");
      await seedGroupMember(group.id, member.id, "member");

      const ws = new MockWebSocket();
      await getGroupMembers(
        ws,
        owner.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("group_members");
      expect(response.data.members.length).toBe(3);

      const roles = response.data.members.map((m: any) => m.role).sort();
      expect(roles).toContain("owner");
      expect(roles).toContain("admin");
      expect(roles).toContain("member");
    });

    test("should include online status", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, member.id, "member");

      // Connect member
      simulateConnection(member.discordId);

      const ws = new MockWebSocket();
      await getGroupMembers(
        ws,
        owner.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      const memberData = response.data.members.find(
        (m: any) => m.userId === member.id,
      );
      expect(memberData.isOnline).toBe(true);
    });
  });

  // ============================================================================
  // Update Member Role Tests
  // ============================================================================

  describe("updateMemberRole", () => {
    test("should allow owner to promote member to admin", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, member.id, "member");

      const { ws: memberWs } = simulateConnection(member.discordId);
      const ws = new MockWebSocket();

      await updateMemberRole(
        ws,
        owner.discordId,
        { groupId: group.id, memberId: member.id, role: "admin" },
        "req-1",
      );

      const response = ws.getLastMessage();
      // Handler sends 'response' to caller, then broadcasts 'member_role_updated'
      expect(response.type).toBe("response");
      expect(response.data.success).toBe(true);

      // Member should be notified via broadcast
      expect(memberWs.hasMessage("member_role_updated")).toBe(true);
    });

    test("should allow owner to demote admin to member", async () => {
      const owner = await seedTestUser();
      const admin = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, admin.id, "admin");

      const { ws: adminWs } = simulateConnection(admin.discordId);
      const ws = new MockWebSocket();

      await updateMemberRole(
        ws,
        owner.discordId,
        { groupId: group.id, memberId: admin.id, role: "member" },
        "req-1",
      );

      const response = ws.getLastMessage();
      // Handler sends 'response' to caller, then broadcasts 'member_role_updated'
      expect(response.type).toBe("response");
      expect(response.data.success).toBe(true);
    });

    test("should reject admin from promoting others", async () => {
      const owner = await seedTestUser();
      const admin = await seedTestUser();
      const member = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, admin.id, "admin");
      await seedGroupMember(group.id, member.id, "member");

      const ws = new MockWebSocket();

      await updateMemberRole(
        ws,
        admin.discordId,
        { groupId: group.id, memberId: member.id, role: "admin" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
    });
  });

  // ============================================================================
  // Remove Member Tests
  // ============================================================================

  describe("removeMemberFromGroup", () => {
    test("should allow owner to remove member", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, member.id, "member");

      const { ws: memberWs } = simulateConnection(member.discordId);
      const ws = new MockWebSocket();

      await removeMemberFromGroup(
        ws,
        owner.discordId,
        { groupId: group.id, memberId: member.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      // Handler sends 'response' to caller, then broadcasts 'member_removed_from_group'
      expect(response.type).toBe("response");
      expect(response.data.success).toBe(true);

      // Removed member should be notified via broadcast
      expect(memberWs.hasMessage("member_removed_from_group")).toBe(true);
    });

    test("should allow admin to remove member", async () => {
      const owner = await seedTestUser();
      const admin = await seedTestUser();
      const member = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, admin.id, "admin");
      await seedGroupMember(group.id, member.id, "member");

      const { ws: memberWs } = simulateConnection(member.discordId);
      const ws = new MockWebSocket();

      await removeMemberFromGroup(
        ws,
        admin.discordId,
        { groupId: group.id, memberId: member.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      // Handler sends 'response' to caller, then broadcasts 'member_removed_from_group'
      expect(response.type).toBe("response");
      expect(response.data.success).toBe(true);
    });

    test("should reject admin from removing other admin", async () => {
      const owner = await seedTestUser();
      const admin1 = await seedTestUser();
      const admin2 = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, admin1.id, "admin");
      await seedGroupMember(group.id, admin2.id, "admin");

      const ws = new MockWebSocket();

      await removeMemberFromGroup(
        ws,
        admin1.discordId,
        { groupId: group.id, memberId: admin2.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
    });

    test("should reject removing owner", async () => {
      const owner = await seedTestUser();
      const admin = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });
      await seedGroupMember(group.id, admin.id, "admin");

      const ws = new MockWebSocket();

      await removeMemberFromGroup(
        ws,
        admin.discordId,
        { groupId: group.id, memberId: owner.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
    });
  });

  // ============================================================================
  // Group Invitations List Tests
  // ============================================================================

  describe("getGroupInvitations", () => {
    test("should return pending invitations for user", async () => {
      const owner = await seedTestUser();
      const invitee = await seedTestUser();
      const group = await seedTestGroup({
        ownerId: owner.id,
        name: "Invite Test Group",
      });

      await db.insert(groupInvitations).values({
        groupId: group.id,
        inviterId: owner.id,
        inviteeId: invitee.id,
        status: "pending",
      });

      const ws = new MockWebSocket();
      await getGroupInvitations(ws, invitee.discordId, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("group_invitations");
      expect(response.data.invitations.length).toBe(1);
      expect(response.data.invitations[0].groupName).toBe("Invite Test Group");
    });

    test("should not return accepted/denied invitations", async () => {
      const owner = await seedTestUser();
      const invitee = await seedTestUser();
      const group = await seedTestGroup({ ownerId: owner.id });

      await db.insert(groupInvitations).values({
        groupId: group.id,
        inviterId: owner.id,
        inviteeId: invitee.id,
        status: "accepted",
      });

      const ws = new MockWebSocket();
      await getGroupInvitations(ws, invitee.discordId, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.invitations.length).toBe(0);
    });
  });
});
