/**
 * Discover Flow Integration Tests
 *
 * Tests the complete group discovery lifecycle:
 * - Browsing discoverable groups (pagination, search, tags, sorting)
 * - Joining open groups
 * - Requesting to join groups (approval flow)
 * - Getting and reviewing join requests
 *
 * @module server/integration/discover-flow.test
 */

import { describe, it, expect, beforeEach, afterEach, test } from "vitest";
import { withNeonTestBranch } from "../test/setup";
import {
  getDiscoverableGroups,
  getDiscoverTags,
  joinOpenGroup,
  requestJoinGroup,
  getJoinRequests,
  reviewJoinRequest,
} from "../handlers/discover";
import { db, groupMembers, groupJoinRequests } from "../lib/db";
import { eq, and } from "drizzle-orm";
import {
  MockWebSocket,
  clearConnectionState,
  simulateConnection,
  seedTestUser,
  seedTestGroup,
  seedGroupMember,
  seedJoinRequest,
  cleanupTestData,
  testUUID,
} from "./test-utils";

describe("Discover Flow Integration Tests", () => {
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
  // Get Discoverable Groups Tests
  // ============================================================================

  describe("getDiscoverableGroups", () => {
    test("should return empty list when searching for non-existent groups", async () => {
      const user = await seedTestUser();
      const ws = new MockWebSocket();

      // Search for a group that definitely doesn't exist
      const nonExistentSearch = `NonExistentGroup-${Date.now()}-${Math.random()}`;
      await getDiscoverableGroups(
        ws,
        user.discordId,
        { search: nonExistentSearch },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("discoverable_groups");
      expect(response.data.groups).toEqual([]);
      expect(response.data.pagination).toEqual({
        page: 1,
        perPage: 20,
        total: 0,
        hasMore: false,
      });
    });

    test("should return discoverable groups", async () => {
      const owner = await seedTestUser();
      const searcher = await seedTestUser();

      const uniqueName = `PublicSquadron-${Date.now()}`;
      await seedTestGroup({
        ownerId: owner.id,
        name: uniqueName,
        visibility: "discoverable",
        joinMethod: "open",
        tags: ["gaming", "sc"],
      });

      const ws = new MockWebSocket();
      await getDiscoverableGroups(
        ws,
        searcher.discordId,
        { search: uniqueName },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("discoverable_groups");
      expect(response.data.groups.length).toBe(1);
      expect(response.data.groups[0].name).toBe(uniqueName);
      expect(response.data.groups[0].joinMethod).toBe("open");
      expect(response.data.groups[0].tags).toContain("gaming");
    });

    test("should exclude private groups", async () => {
      const owner = await seedTestUser();
      const searcher = await seedTestUser();

      const prefix = `ExcludePrivate-${Date.now()}`;
      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Private`,
        visibility: "private",
      });

      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Public`,
        visibility: "discoverable",
      });

      const ws = new MockWebSocket();
      await getDiscoverableGroups(
        ws,
        searcher.discordId,
        { search: prefix },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.groups.length).toBe(1);
      expect(response.data.groups[0].name).toBe(`${prefix}-Public`);
    });

    test("should exclude groups user is already a member of", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();

      const prefix = `MemberTest-${Date.now()}`;
      const group = await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Joined`,
        visibility: "discoverable",
      });
      await seedGroupMember(group.id, member.id, "member");

      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-NotJoined`,
        visibility: "discoverable",
      });

      const ws = new MockWebSocket();
      await getDiscoverableGroups(
        ws,
        member.discordId,
        { search: prefix },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.groups.length).toBe(1);
      expect(response.data.groups[0].name).toBe(`${prefix}-NotJoined`);
    });

    test("should mark groups with pending join requests", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const prefix = `PendingRequestTest-${Date.now()}`;
      const group = await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-WithRequest`,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedJoinRequest(group.id, requester.id);

      // Also create a group without a pending request for comparison
      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-NoRequest`,
        visibility: "discoverable",
        joinMethod: "request",
      });

      const ws = new MockWebSocket();
      await getDiscoverableGroups(
        ws,
        requester.discordId,
        { search: prefix },
        "req-1",
      );

      const response = ws.getLastMessage();
      // Groups with pending requests are still shown but marked with hasPendingRequest: true
      expect(response.data.groups.length).toBe(2);

      const withRequest = response.data.groups.find(
        (g: any) => g.name === `${prefix}-WithRequest`,
      );
      const noRequest = response.data.groups.find(
        (g: any) => g.name === `${prefix}-NoRequest`,
      );

      expect(withRequest).toBeDefined();
      expect(withRequest.hasPendingRequest).toBe(true);
      expect(noRequest).toBeDefined();
      expect(noRequest.hasPendingRequest).toBe(false);
    });

    test("should paginate results correctly", async () => {
      const owner = await seedTestUser();
      const searcher = await seedTestUser();

      // Create 5 discoverable groups with unique prefix
      const prefix = `PaginationTest-${Date.now()}`;
      for (let i = 0; i < 5; i++) {
        await seedTestGroup({
          ownerId: owner.id,
          name: `${prefix}-${i}`,
          visibility: "discoverable",
        });
      }

      const ws = new MockWebSocket();
      await getDiscoverableGroups(
        ws,
        searcher.discordId,
        { page: 1, perPage: 2, search: prefix },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.groups.length).toBe(2);
      expect(response.data.pagination.page).toBe(1);
      expect(response.data.pagination.perPage).toBe(2);
      expect(response.data.pagination.total).toBe(5);
      expect(response.data.pagination.hasMore).toBe(true);
    });

    test("should search by group name", async () => {
      const owner = await seedTestUser();
      const searcher = await seedTestUser();

      const prefix = `SearchTest-${Date.now()}`;
      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Alpha`,
        visibility: "discoverable",
      });

      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Beta`,
        visibility: "discoverable",
      });

      const ws = new MockWebSocket();
      await getDiscoverableGroups(
        ws,
        searcher.discordId,
        { search: `${prefix}-Alpha` },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.groups.length).toBe(1);
      expect(response.data.groups[0].name).toBe(`${prefix}-Alpha`);
    });

    test("should filter by tags", async () => {
      const owner = await seedTestUser();
      const searcher = await seedTestUser();

      const prefix = `TagTest-${Date.now()}`;
      const uniqueTag = `gaming-${Date.now()}`;
      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Gaming`,
        visibility: "discoverable",
        tags: [uniqueTag, "fps"],
      });

      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Trading`,
        visibility: "discoverable",
        tags: ["trading", "economy"],
      });

      const ws = new MockWebSocket();
      await getDiscoverableGroups(
        ws,
        searcher.discordId,
        { tags: [uniqueTag], search: prefix },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.groups.length).toBe(1);
      expect(response.data.groups[0].name).toBe(`${prefix}-Gaming`);
    });

    test("should sort by name alphabetically", async () => {
      const owner = await seedTestUser();
      const searcher = await seedTestUser();

      // Use unique prefix to isolate this test
      const prefix = `SortTest-${Date.now()}`;
      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Zeta`,
        visibility: "discoverable",
      });
      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Alpha`,
        visibility: "discoverable",
      });
      await seedTestGroup({
        ownerId: owner.id,
        name: `${prefix}-Beta`,
        visibility: "discoverable",
      });

      const ws = new MockWebSocket();
      await getDiscoverableGroups(
        ws,
        searcher.discordId,
        { sortBy: "name", search: prefix },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.groups.length).toBe(3);
      expect(response.data.groups[0].name).toBe(`${prefix}-Alpha`);
      expect(response.data.groups[1].name).toBe(`${prefix}-Beta`);
      expect(response.data.groups[2].name).toBe(`${prefix}-Zeta`);
    });

    test("should include member count and owner info", async () => {
      const ownerUsername = `squadron-leader-${Date.now()}`;
      const owner = await seedTestUser({ username: ownerUsername });
      const member1 = await seedTestUser();
      const member2 = await seedTestUser();
      const searcher = await seedTestUser();

      const groupName = `PopularGroup-${Date.now()}`;
      const group = await seedTestGroup({
        ownerId: owner.id,
        name: groupName,
        visibility: "discoverable",
      });
      await seedGroupMember(group.id, member1.id, "member");
      await seedGroupMember(group.id, member2.id, "member");

      const ws = new MockWebSocket();
      await getDiscoverableGroups(
        ws,
        searcher.discordId,
        { search: groupName },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.groups.length).toBe(1);
      expect(response.data.groups[0].memberCount).toBe(3); // owner + 2 members
      expect(response.data.groups[0].ownerUsername).toBe(ownerUsername);
    });
  });

  // ============================================================================
  // Get Discover Tags Tests
  // ============================================================================

  describe("getDiscoverTags", () => {
    test("should return empty array if no discoverable groups", async () => {
      const user = await seedTestUser();
      const ws = new MockWebSocket();

      await getDiscoverTags(ws, user.discordId, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("discover_tags");
      expect(response.data).toEqual([]);
    });

    test("should return popular tags from discoverable groups", async () => {
      const owner = await seedTestUser();
      const user = await seedTestUser();

      // Use unique tags that won't conflict with other tests
      const uniqueTag = `unique-gaming-${Date.now()}`;
      await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        tags: [uniqueTag, "sc"],
      });

      await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        tags: [uniqueTag, "fps"],
      });

      await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        tags: ["trading"],
      });

      const ws = new MockWebSocket();
      await getDiscoverTags(ws, user.discordId, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("discover_tags");

      // Our unique tag appears twice
      const gamingTag = response.data.find((t: any) => t.tag === uniqueTag);
      expect(gamingTag).toBeDefined();
      expect(gamingTag.count).toBe(2);
    });

    test("should exclude tags from private groups", async () => {
      const owner = await seedTestUser();
      const user = await seedTestUser();

      const secretTag = `secret-tag-${Date.now()}`;
      const publicTag = `public-tag-${Date.now()}`;

      await seedTestGroup({
        ownerId: owner.id,
        visibility: "private",
        tags: [secretTag],
      });

      await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        tags: [publicTag],
      });

      const ws = new MockWebSocket();
      await getDiscoverTags(ws, user.discordId, "req-1");

      const response = ws.getLastMessage();
      const tags = response.data.map((t: any) => t.tag);
      expect(tags).not.toContain(secretTag);
      expect(tags).toContain(publicTag);
    });
  });

  // ============================================================================
  // Join Open Group Tests
  // ============================================================================

  describe("joinOpenGroup", () => {
    test("should join open discoverable group successfully", async () => {
      const owner = await seedTestUser();
      const joiner = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        name: "Open Squadron",
        visibility: "discoverable",
        joinMethod: "open",
      });

      const ws = new MockWebSocket();
      await joinOpenGroup(ws, joiner.discordId, { groupId: group.id }, "req-1");

      const response = ws.getLastMessage();
      expect(response.type).toBe("join_open_group_result");
      expect(response.data.success).toBe(true);
      expect(response.data.group.name).toBe("Open Squadron");
      expect(response.data.group.memberRole).toBe("member");
    });

    test("should notify other members when someone joins", async () => {
      const owner = await seedTestUser();
      const existingMember = await seedTestUser();
      const joiner = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "open",
      });
      await seedGroupMember(group.id, existingMember.id, "member");

      const { ws: ownerWs } = simulateConnection(owner.discordId);
      const { ws: memberWs } = simulateConnection(existingMember.discordId);
      const ws = new MockWebSocket();

      await joinOpenGroup(ws, joiner.discordId, { groupId: group.id }, "req-1");

      expect(ownerWs.hasMessage("member_joined_group")).toBe(true);
      expect(memberWs.hasMessage("member_joined_group")).toBe(true);
    });

    test("should reject if group not discoverable", async () => {
      const owner = await seedTestUser();
      const joiner = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "private",
        joinMethod: "open",
      });

      const ws = new MockWebSocket();
      await joinOpenGroup(ws, joiner.discordId, { groupId: group.id }, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("not discoverable");
    });

    test("should reject if group requires approval", async () => {
      const owner = await seedTestUser();
      const joiner = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });

      const ws = new MockWebSocket();
      await joinOpenGroup(ws, joiner.discordId, { groupId: group.id }, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("requires approval");
    });

    test("should reject if already a member", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "open",
      });
      await seedGroupMember(group.id, member.id, "member");

      const ws = new MockWebSocket();
      await joinOpenGroup(ws, member.discordId, { groupId: group.id }, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error.toLowerCase()).toContain("already");
    });

    test("should reject invalid group ID", async () => {
      const user = await seedTestUser();
      const ws = new MockWebSocket();

      await joinOpenGroup(ws, user.discordId, { groupId: "invalid" }, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("Invalid");
    });

    test("should reject non-existent group", async () => {
      const user = await seedTestUser();
      const ws = new MockWebSocket();

      await joinOpenGroup(ws, user.discordId, { groupId: testUUID() }, "req-1");

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("not found");
    });
  });

  // ============================================================================
  // Request Join Group Tests
  // ============================================================================

  describe("requestJoinGroup", () => {
    test("should create join request for approval-required group", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        name: "Invite Only Squadron",
        visibility: "discoverable",
        joinMethod: "request",
      });

      const ws = new MockWebSocket();
      await requestJoinGroup(
        ws,
        requester.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("request_join_group_result");
      expect(response.data.success).toBe(true);
      expect(response.data.requestId).toBeDefined();
    });

    test("should store optional message", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });

      const ws = new MockWebSocket();
      await requestJoinGroup(
        ws,
        requester.discordId,
        { groupId: group.id, message: "Please let me in!" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(true);

      // Verify message was stored
      const [request] = await db
        .select()
        .from(groupJoinRequests)
        .where(eq(groupJoinRequests.id, response.data.requestId));
      expect(request.message).toBe("Please let me in!");
    });

    test("should notify owner and admins", async () => {
      const owner = await seedTestUser();
      const admin = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedGroupMember(group.id, admin.id, "admin");

      const { ws: ownerWs } = simulateConnection(owner.discordId);
      const { ws: adminWs } = simulateConnection(admin.discordId);
      const ws = new MockWebSocket();

      await requestJoinGroup(
        ws,
        requester.discordId,
        { groupId: group.id },
        "req-1",
      );

      expect(ownerWs.hasMessage("new_join_request")).toBe(true);
      expect(adminWs.hasMessage("new_join_request")).toBe(true);
    });

    test("should reject if group not discoverable", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "private",
        joinMethod: "request",
      });

      const ws = new MockWebSocket();
      await requestJoinGroup(
        ws,
        requester.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("not discoverable");
    });

    test("should reject if group is open", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "open",
      });

      const ws = new MockWebSocket();
      await requestJoinGroup(
        ws,
        requester.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("open joining");
    });

    test("should reject if already a member", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedGroupMember(group.id, member.id, "member");

      const ws = new MockWebSocket();
      await requestJoinGroup(
        ws,
        member.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error.toLowerCase()).toContain("already");
    });

    test("should reject if request already pending", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedJoinRequest(group.id, requester.id);

      const ws = new MockWebSocket();
      await requestJoinGroup(
        ws,
        requester.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("pending");
    });
  });

  // ============================================================================
  // Get Join Requests Tests
  // ============================================================================

  describe("getJoinRequests", () => {
    test("should allow owner to view pending requests", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser({ username: "eager-pilot" });

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedJoinRequest(group.id, requester.id, "Let me in please!");

      const ws = new MockWebSocket();
      await getJoinRequests(
        ws,
        owner.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("join_requests");
      expect(response.data.length).toBe(1);
      expect(response.data[0].username).toBe("eager-pilot");
      expect(response.data[0].message).toBe("Let me in please!");
      expect(response.data[0].status).toBe("pending");
    });

    test("should allow admin to view pending requests", async () => {
      const owner = await seedTestUser();
      const admin = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedGroupMember(group.id, admin.id, "admin");
      await seedJoinRequest(group.id, requester.id);

      const ws = new MockWebSocket();
      await getJoinRequests(
        ws,
        admin.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("join_requests");
      expect(response.data.length).toBe(1);
    });

    test("should reject member from viewing requests", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedGroupMember(group.id, member.id, "member");
      await seedJoinRequest(group.id, requester.id);

      const ws = new MockWebSocket();
      await getJoinRequests(
        ws,
        member.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
      expect(response.error).toContain("Not authorized");
    });

    test("should reject non-member from viewing requests", async () => {
      const owner = await seedTestUser();
      const stranger = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });

      const ws = new MockWebSocket();
      await getJoinRequests(
        ws,
        stranger.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("error");
    });

    test("should return empty array for group with no pending requests", async () => {
      const owner = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });

      const ws = new MockWebSocket();
      await getJoinRequests(
        ws,
        owner.discordId,
        { groupId: group.id },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("join_requests");
      expect(response.data).toEqual([]);
    });
  });

  // ============================================================================
  // Review Join Request Tests
  // ============================================================================

  describe("reviewJoinRequest", () => {
    test("should allow owner to approve request", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        name: "Approval Group",
        visibility: "discoverable",
        joinMethod: "request",
      });
      const request = await seedJoinRequest(group.id, requester.id);

      const { ws: requesterWs } = simulateConnection(requester.discordId);
      const ws = new MockWebSocket();

      await reviewJoinRequest(
        ws,
        owner.discordId,
        { requestId: request.id, decision: "approve" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.type).toBe("review_join_request_result");
      expect(response.data.success).toBe(true);

      // Requester should be notified with group data
      expect(requesterWs.hasMessage("join_request_reviewed")).toBe(true);
      const notification = requesterWs.getMessagesByType(
        "join_request_reviewed",
      )[0];
      expect(notification.data.decision).toBe("approve");
      expect(notification.data.group).toBeDefined();
      expect(notification.data.group.name).toBe("Approval Group");
    });

    test("should add user as member when approved", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      const request = await seedJoinRequest(group.id, requester.id);

      const ws = new MockWebSocket();
      await reviewJoinRequest(
        ws,
        owner.discordId,
        { requestId: request.id, decision: "approve" },
        "req-1",
      );

      // Verify membership was created
      const [membership] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, group.id),
            eq(groupMembers.userId, requester.id),
          ),
        );
      expect(membership).toBeDefined();
      expect(membership.role).toBe("member");
    });

    test("should notify other members when request approved", async () => {
      const owner = await seedTestUser();
      const existingMember = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedGroupMember(group.id, existingMember.id, "member");
      const request = await seedJoinRequest(group.id, requester.id);

      const { ws: memberWs } = simulateConnection(existingMember.discordId);
      const ws = new MockWebSocket();

      await reviewJoinRequest(
        ws,
        owner.discordId,
        { requestId: request.id, decision: "approve" },
        "req-1",
      );

      expect(memberWs.hasMessage("member_joined_group")).toBe(true);
    });

    test("should allow owner to deny request", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      const request = await seedJoinRequest(group.id, requester.id);

      const { ws: requesterWs } = simulateConnection(requester.discordId);
      const ws = new MockWebSocket();

      await reviewJoinRequest(
        ws,
        owner.discordId,
        { requestId: request.id, decision: "deny" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(true);

      // Requester should be notified with deny decision
      expect(requesterWs.hasMessage("join_request_reviewed")).toBe(true);
      const notification = requesterWs.getMessagesByType(
        "join_request_reviewed",
      )[0];
      expect(notification.data.decision).toBe("deny");
      expect(notification.data.group).toBeNull();
    });

    test("should allow admin to approve request", async () => {
      const owner = await seedTestUser();
      const admin = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedGroupMember(group.id, admin.id, "admin");
      const request = await seedJoinRequest(group.id, requester.id);

      const ws = new MockWebSocket();
      await reviewJoinRequest(
        ws,
        admin.discordId,
        { requestId: request.id, decision: "approve" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(true);
    });

    test("should reject member from reviewing request", async () => {
      const owner = await seedTestUser();
      const member = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      await seedGroupMember(group.id, member.id, "member");
      const request = await seedJoinRequest(group.id, requester.id);

      const ws = new MockWebSocket();
      await reviewJoinRequest(
        ws,
        member.discordId,
        { requestId: request.id, decision: "approve" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("Not authorized");
    });

    test("should reject already-processed request", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      const request = await seedJoinRequest(
        group.id,
        requester.id,
        undefined,
        "approved",
      );

      const ws = new MockWebSocket();
      await reviewJoinRequest(
        ws,
        owner.discordId,
        { requestId: request.id, decision: "approve" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("already processed");
    });

    test("should reject invalid request ID", async () => {
      const owner = await seedTestUser();
      await seedTestGroup({ ownerId: owner.id });

      const ws = new MockWebSocket();
      await reviewJoinRequest(
        ws,
        owner.discordId,
        { requestId: "invalid", decision: "approve" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("Invalid");
    });

    test("should reject non-existent request", async () => {
      const owner = await seedTestUser();
      await seedTestGroup({ ownerId: owner.id });

      const ws = new MockWebSocket();
      await reviewJoinRequest(
        ws,
        owner.discordId,
        { requestId: testUUID(), decision: "approve" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("not found");
    });

    test("should reject invalid decision", async () => {
      const owner = await seedTestUser();
      const requester = await seedTestUser();

      const group = await seedTestGroup({
        ownerId: owner.id,
        visibility: "discoverable",
        joinMethod: "request",
      });
      const request = await seedJoinRequest(group.id, requester.id);

      const ws = new MockWebSocket();
      await reviewJoinRequest(
        ws,
        owner.discordId,
        { requestId: request.id, decision: "maybe" },
        "req-1",
      );

      const response = ws.getLastMessage();
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain("Invalid decision");
    });
  });
});
