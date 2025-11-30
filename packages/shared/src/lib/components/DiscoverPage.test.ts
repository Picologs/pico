/**
 * Tests for DiscoverPage.svelte
 *
 * Tests the component logic including:
 * - Search filtering
 * - Tag filtering
 * - Sorting logic
 * - Pagination
 * - Join button states
 * - Active filter detection
 */

import { describe, it, expect } from "vitest";
import {
  createTestDiscoverableGroup,
  createTestDiscoverableGroups,
  createRequestToJoinGroup,
  createJoinedDiscoverableGroup,
  createPendingRequestGroup,
} from "../test-utils";
import type { DiscoverableGroup } from "@pico/types";

// ============================================================================
// Helper function tests (extracted from DiscoverPage.svelte)
// ============================================================================

/**
 * Filter groups by search query (name matching)
 */
function filterGroupsBySearch(
  groups: DiscoverableGroup[],
  query: string,
): DiscoverableGroup[] {
  if (!query.trim()) return groups;

  const lowerQuery = query.toLowerCase();
  return groups.filter((g) => g.name.toLowerCase().includes(lowerQuery));
}

/**
 * Filter groups by selected tags
 */
function filterGroupsByTags(
  groups: DiscoverableGroup[],
  selectedTags: string[],
): DiscoverableGroup[] {
  if (selectedTags.length === 0) return groups;

  return groups.filter((g) => selectedTags.some((tag) => g.tags.includes(tag)));
}

/**
 * Sort groups by different criteria
 */
function sortGroups(
  groups: DiscoverableGroup[],
  sortBy: "popular" | "recent" | "name",
): DiscoverableGroup[] {
  return [...groups].sort((a, b) => {
    switch (sortBy) {
      case "popular":
        return b.memberCount - a.memberCount;
      case "recent":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "name":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });
}

/**
 * Check if any filters are active
 */
function hasActiveFilters(
  searchQuery: string,
  selectedTags: string[],
  sortBy: string,
): boolean {
  return !!searchQuery || selectedTags.length > 0 || sortBy !== "popular";
}

/**
 * Get join button state for a group
 */
function getJoinButtonState(
  group: DiscoverableGroup,
): "joined" | "pending" | "open" | "request" {
  if (group.isJoined) return "joined";
  if (group.hasPendingRequest) return "pending";
  if (group.joinMethod === "open") return "open";
  return "request";
}

/**
 * Get join button text for a group
 */
function getJoinButtonText(
  state: "joined" | "pending" | "open" | "request",
): string {
  switch (state) {
    case "joined":
      return "Joined";
    case "pending":
      return "Request Pending";
    case "open":
      return "Join";
    case "request":
      return "Request to Join";
  }
}

/**
 * Check if join button should be disabled
 */
function isJoinButtonDisabled(
  state: "joined" | "pending" | "open" | "request",
): boolean {
  return state === "joined" || state === "pending";
}

/**
 * Paginate groups
 */
function paginateGroups(
  groups: DiscoverableGroup[],
  page: number,
  pageSize: number,
): { groups: DiscoverableGroup[]; hasMore: boolean; total: number } {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedGroups = groups.slice(start, end);

  return {
    groups: paginatedGroups,
    hasMore: end < groups.length,
    total: groups.length,
  };
}

// ============================================================================
// Search Tests
// ============================================================================

describe("DiscoverPage - Search Filtering", () => {
  it("should filter groups by name", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", name: "Alpha Squadron" }),
      createTestDiscoverableGroup({ id: "2", name: "Beta Team" }),
      createTestDiscoverableGroup({ id: "3", name: "Alpha Trading" }),
    ];

    const filtered = filterGroupsBySearch(groups, "alpha");

    expect(filtered).toHaveLength(2);
    expect(filtered.every((g) => g.name.toLowerCase().includes("alpha"))).toBe(
      true,
    );
  });

  it("should be case-insensitive", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", name: "Test Group" }),
    ];

    expect(filterGroupsBySearch(groups, "test")).toHaveLength(1);
    expect(filterGroupsBySearch(groups, "TEST")).toHaveLength(1);
    expect(filterGroupsBySearch(groups, "Test")).toHaveLength(1);
  });

  it("should return all groups when search is empty", () => {
    const groups = createTestDiscoverableGroups(5);

    expect(filterGroupsBySearch(groups, "")).toHaveLength(5);
    expect(filterGroupsBySearch(groups, "   ")).toHaveLength(5);
  });

  it("should return empty array when no matches", () => {
    const groups = createTestDiscoverableGroups(5);
    const filtered = filterGroupsBySearch(groups, "nonexistent");
    expect(filtered).toHaveLength(0);
  });

  it("should handle partial matches", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", name: "Star Citizen Explorers" }),
    ];

    expect(filterGroupsBySearch(groups, "star")).toHaveLength(1);
    expect(filterGroupsBySearch(groups, "citizen")).toHaveLength(1);
    expect(filterGroupsBySearch(groups, "exp")).toHaveLength(1);
  });
});

// ============================================================================
// Tag Filter Tests
// ============================================================================

describe("DiscoverPage - Tag Filtering", () => {
  it("should filter groups by single tag", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", tags: ["pve", "trading"] }),
      createTestDiscoverableGroup({ id: "2", tags: ["pvp", "combat"] }),
      createTestDiscoverableGroup({ id: "3", tags: ["pve", "exploration"] }),
    ];

    const filtered = filterGroupsByTags(groups, ["pve"]);

    expect(filtered).toHaveLength(2);
  });

  it("should filter groups by multiple tags (OR logic)", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", tags: ["pve"] }),
      createTestDiscoverableGroup({ id: "2", tags: ["pvp"] }),
      createTestDiscoverableGroup({ id: "3", tags: ["trading"] }),
    ];

    const filtered = filterGroupsByTags(groups, ["pve", "pvp"]);

    expect(filtered).toHaveLength(2);
  });

  it("should return all groups when no tags selected", () => {
    const groups = createTestDiscoverableGroups(5);
    const filtered = filterGroupsByTags(groups, []);
    expect(filtered).toHaveLength(5);
  });

  it("should return empty when no groups match tags", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", tags: ["pve"] }),
      createTestDiscoverableGroup({ id: "2", tags: ["trading"] }),
    ];

    const filtered = filterGroupsByTags(groups, ["mining"]);
    expect(filtered).toHaveLength(0);
  });

  it("should handle groups with empty tags", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", tags: ["pve"] }),
      createTestDiscoverableGroup({ id: "2", tags: [] }),
    ];

    const filtered = filterGroupsByTags(groups, ["pve"]);
    expect(filtered).toHaveLength(1);
  });
});

// ============================================================================
// Sorting Tests
// ============================================================================

describe("DiscoverPage - Sorting", () => {
  it("should sort by popularity (member count descending)", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", memberCount: 10 }),
      createTestDiscoverableGroup({ id: "2", memberCount: 50 }),
      createTestDiscoverableGroup({ id: "3", memberCount: 25 }),
    ];

    const sorted = sortGroups(groups, "popular");

    expect(sorted[0].memberCount).toBe(50);
    expect(sorted[1].memberCount).toBe(25);
    expect(sorted[2].memberCount).toBe(10);
  });

  it("should sort by recent (creation date descending)", () => {
    const groups = [
      createTestDiscoverableGroup({
        id: "1",
        createdAt: "2024-01-01T00:00:00Z",
      }),
      createTestDiscoverableGroup({
        id: "2",
        createdAt: "2024-03-01T00:00:00Z",
      }),
      createTestDiscoverableGroup({
        id: "3",
        createdAt: "2024-02-01T00:00:00Z",
      }),
    ];

    const sorted = sortGroups(groups, "recent");

    expect(sorted[0].createdAt).toBe("2024-03-01T00:00:00Z");
    expect(sorted[1].createdAt).toBe("2024-02-01T00:00:00Z");
    expect(sorted[2].createdAt).toBe("2024-01-01T00:00:00Z");
  });

  it("should sort by name (alphabetically ascending)", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", name: "Zulu Force" }),
      createTestDiscoverableGroup({ id: "2", name: "Alpha Team" }),
      createTestDiscoverableGroup({ id: "3", name: "Mike Squad" }),
    ];

    const sorted = sortGroups(groups, "name");

    expect(sorted[0].name).toBe("Alpha Team");
    expect(sorted[1].name).toBe("Mike Squad");
    expect(sorted[2].name).toBe("Zulu Force");
  });

  it("should handle empty array", () => {
    const sorted = sortGroups([], "popular");
    expect(sorted).toHaveLength(0);
  });

  it("should not mutate original array", () => {
    const groups = [
      createTestDiscoverableGroup({ id: "1", memberCount: 10 }),
      createTestDiscoverableGroup({ id: "2", memberCount: 50 }),
    ];

    const originalFirstId = groups[0].id;
    sortGroups(groups, "popular");

    expect(groups[0].id).toBe(originalFirstId);
  });
});

// ============================================================================
// Active Filter Detection Tests
// ============================================================================

describe("DiscoverPage - Active Filter Detection", () => {
  it("should detect search query as active filter", () => {
    expect(hasActiveFilters("test", [], "popular")).toBe(true);
  });

  it("should detect selected tags as active filter", () => {
    expect(hasActiveFilters("", ["pve"], "popular")).toBe(true);
    expect(hasActiveFilters("", ["pve", "pvp"], "popular")).toBe(true);
  });

  it("should detect non-default sort as active filter", () => {
    expect(hasActiveFilters("", [], "recent")).toBe(true);
    expect(hasActiveFilters("", [], "name")).toBe(true);
  });

  it("should detect no active filters for default state", () => {
    expect(hasActiveFilters("", [], "popular")).toBe(false);
  });

  it("should detect multiple active filters", () => {
    expect(hasActiveFilters("test", ["pve"], "recent")).toBe(true);
  });
});

// ============================================================================
// Join Button State Tests
// ============================================================================

describe("DiscoverPage - Join Button State", () => {
  it("should return joined state for joined group", () => {
    const group = createJoinedDiscoverableGroup();
    expect(getJoinButtonState(group)).toBe("joined");
  });

  it("should return pending state for pending request group", () => {
    const group = createPendingRequestGroup();
    expect(getJoinButtonState(group)).toBe("pending");
  });

  it("should return open state for open join groups", () => {
    const group = createTestDiscoverableGroup({
      joinMethod: "open",
      isJoined: false,
    });
    expect(getJoinButtonState(group)).toBe("open");
  });

  it("should return request state for request-to-join groups", () => {
    const group = createRequestToJoinGroup();
    expect(getJoinButtonState(group)).toBe("request");
  });

  it("should prioritize joined over pending", () => {
    const group = createTestDiscoverableGroup({
      isJoined: true,
      hasPendingRequest: true,
    });
    expect(getJoinButtonState(group)).toBe("joined");
  });

  it("should prioritize pending over open/request", () => {
    const group = createTestDiscoverableGroup({
      isJoined: false,
      hasPendingRequest: true,
      joinMethod: "open",
    });
    expect(getJoinButtonState(group)).toBe("pending");
  });
});

// ============================================================================
// Join Button Text Tests
// ============================================================================

describe("DiscoverPage - Join Button Text", () => {
  it("should return correct text for joined state", () => {
    expect(getJoinButtonText("joined")).toBe("Joined");
  });

  it("should return correct text for pending state", () => {
    expect(getJoinButtonText("pending")).toBe("Request Pending");
  });

  it("should return correct text for open state", () => {
    expect(getJoinButtonText("open")).toBe("Join");
  });

  it("should return correct text for request state", () => {
    expect(getJoinButtonText("request")).toBe("Request to Join");
  });
});

// ============================================================================
// Join Button Disabled Tests
// ============================================================================

describe("DiscoverPage - Join Button Disabled", () => {
  it("should disable button for joined groups", () => {
    expect(isJoinButtonDisabled("joined")).toBe(true);
  });

  it("should disable button for pending groups", () => {
    expect(isJoinButtonDisabled("pending")).toBe(true);
  });

  it("should enable button for open groups", () => {
    expect(isJoinButtonDisabled("open")).toBe(false);
  });

  it("should enable button for request groups", () => {
    expect(isJoinButtonDisabled("request")).toBe(false);
  });
});

// ============================================================================
// Pagination Tests
// ============================================================================

describe("DiscoverPage - Pagination", () => {
  it("should return first page of groups", () => {
    const groups = createTestDiscoverableGroups(25);
    const result = paginateGroups(groups, 1, 10);

    expect(result.groups).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(25);
  });

  it("should return second page of groups", () => {
    const groups = createTestDiscoverableGroups(25);
    const result = paginateGroups(groups, 2, 10);

    expect(result.groups).toHaveLength(10);
    expect(result.hasMore).toBe(true);
  });

  it("should return last page with remaining groups", () => {
    const groups = createTestDiscoverableGroups(25);
    const result = paginateGroups(groups, 3, 10);

    expect(result.groups).toHaveLength(5);
    expect(result.hasMore).toBe(false);
  });

  it("should handle page size larger than total", () => {
    const groups = createTestDiscoverableGroups(5);
    const result = paginateGroups(groups, 1, 10);

    expect(result.groups).toHaveLength(5);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(5);
  });

  it("should handle empty groups array", () => {
    const result = paginateGroups([], 1, 10);

    expect(result.groups).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.total).toBe(0);
  });

  it("should handle exact page boundary", () => {
    const groups = createTestDiscoverableGroups(20);
    const result = paginateGroups(groups, 2, 10);

    expect(result.groups).toHaveLength(10);
    expect(result.hasMore).toBe(false);
  });
});

// ============================================================================
// Results Header Tests
// ============================================================================

describe("DiscoverPage - Results Header", () => {
  it("should format singular result correctly", () => {
    const count = 1;
    const text = `${count} group${count === 1 ? "" : "s"} found`;
    expect(text).toBe("1 group found");
  });

  it("should format plural results correctly", () => {
    const count = 5;
    const text = `${count} group${count === 1 ? "" : "s"} found`;
    expect(text).toBe("5 groups found");
  });

  it("should format zero results correctly", () => {
    const count = 0;
    const text = `${count} group${count === 1 ? "" : "s"} found`;
    expect(text).toBe("0 groups found");
  });
});

// ============================================================================
// Group Card Display Tests
// ============================================================================

describe("DiscoverPage - Group Card Display", () => {
  it("should display group with all fields", () => {
    const group = createTestDiscoverableGroup({
      name: "Test Group",
      description: "A test description",
      avatar: "https://example.com/avatar.png",
      tags: ["pve", "trading"],
      memberCount: 25,
      ownerUsername: "Owner",
    });

    expect(group.name).toBe("Test Group");
    expect(group.description).toBe("A test description");
    expect(group.avatar).toBe("https://example.com/avatar.png");
    expect(group.tags).toContain("pve");
    expect(group.memberCount).toBe(25);
    expect(group.ownerUsername).toBe("Owner");
  });

  it("should handle group with minimal fields", () => {
    const group = createTestDiscoverableGroup({
      name: "Minimal Group",
      description: undefined,
      avatar: null,
      tags: [],
    });

    expect(group.name).toBe("Minimal Group");
    expect(group.description).toBeUndefined();
    expect(group.avatar).toBeNull();
    expect(group.tags).toHaveLength(0);
  });

  it("should display member count with correct grammar", () => {
    const singleMember = createTestDiscoverableGroup({ memberCount: 1 });
    const multipleMembers = createTestDiscoverableGroup({ memberCount: 10 });

    const singleText = `${singleMember.memberCount} member${singleMember.memberCount === 1 ? "" : "s"}`;
    const multipleText = `${multipleMembers.memberCount} member${multipleMembers.memberCount === 1 ? "" : "s"}`;

    expect(singleText).toBe("1 member");
    expect(multipleText).toBe("10 members");
  });
});

// ============================================================================
// Combined Filter Tests
// ============================================================================

describe("DiscoverPage - Combined Filters", () => {
  it("should apply search and tag filters together", () => {
    const groups = [
      createTestDiscoverableGroup({
        id: "1",
        name: "Alpha PVE",
        tags: ["pve"],
      }),
      createTestDiscoverableGroup({
        id: "2",
        name: "Alpha PVP",
        tags: ["pvp"],
      }),
      createTestDiscoverableGroup({ id: "3", name: "Beta PVE", tags: ["pve"] }),
    ];

    let filtered = filterGroupsBySearch(groups, "alpha");
    filtered = filterGroupsByTags(filtered, ["pve"]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Alpha PVE");
  });

  it("should apply all filters and sort", () => {
    const groups = [
      createTestDiscoverableGroup({
        id: "1",
        name: "Zulu PVE",
        tags: ["pve"],
        memberCount: 10,
      }),
      createTestDiscoverableGroup({
        id: "2",
        name: "Alpha PVE",
        tags: ["pve"],
        memberCount: 50,
      }),
      createTestDiscoverableGroup({
        id: "3",
        name: "Alpha PVP",
        tags: ["pvp"],
        memberCount: 30,
      }),
    ];

    let filtered = filterGroupsBySearch(groups, "alpha");
    filtered = filterGroupsByTags(filtered, ["pve"]);
    const sorted = sortGroups(filtered, "popular");

    expect(sorted).toHaveLength(1);
    expect(sorted[0].name).toBe("Alpha PVE");
  });
});
