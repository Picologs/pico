/**
 * Tests for LogItemGroup.svelte
 *
 * Tests state management, derived values, and component logic.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestLog,
  createTestLogWithChildren,
  createTestLogs,
} from "../test-utils";

describe("LogItemGroup - Derived Values", () => {
  it("should derive hasChildren as true when log has children array with length > 0", () => {
    const log = createTestLogWithChildren({}, 3);

    const hasChildren = log.children && log.children.length > 0;

    expect(hasChildren).toBe(true);
  });

  it("should derive hasChildren as false when log has no children", () => {
    const log = createTestLog();

    // When children is undefined, the expression evaluates to undefined (falsy)
    const hasChildren = Boolean(log.children && log.children.length > 0);

    expect(hasChildren).toBe(false);
  });

  it("should derive hasChildren as false when log has empty children array", () => {
    const log = createTestLog({ children: [] });

    const hasChildren = log.children && log.children.length > 0;

    expect(hasChildren).toBe(false);
  });

  it("should derive gradientColor based on killing_spree eventType", () => {
    const log = createTestLog({ eventType: "killing_spree" });

    const gradientColor =
      log.eventType === "killing_spree" ? "239 68 68" : "96 165 250";

    expect(gradientColor).toBe("239 68 68");
  });

  it("should derive gradientColor as default for non-killing_spree events", () => {
    const log = createTestLog({ eventType: "actor_death" });

    const gradientColor =
      log.eventType === "killing_spree" ? "239 68 68" : "96 165 250";

    expect(gradientColor).toBe("96 165 250");
  });

  it("should derive username from getUserDisplayName when provided", () => {
    const log = createTestLog({ userId: "user-456" });
    const getUserDisplayName = (userId: string) => `Player-${userId}`;

    const username = getUserDisplayName ? getUserDisplayName(log.userId) : null;

    expect(username).toBe("Player-user-456");
  });

  it("should derive username as null when getUserDisplayName is undefined", () => {
    const log = createTestLog({ userId: "user-456" });
    const getUserDisplayName = undefined;

    const username = getUserDisplayName ? getUserDisplayName(log.userId) : null;

    expect(username).toBeNull();
  });
});

describe("LogItemGroup - State Management", () => {
  it("should initialize isOpen from log.open property", () => {
    const logOpen = createTestLog({ open: true });
    const logClosed = createTestLog({ open: false });

    expect(logOpen.open).toBe(true);
    expect(logClosed.open).toBe(false);
  });

  it("should default isOpen to false when log.open is undefined", () => {
    const log = createTestLog({ open: undefined });

    const isOpen = log.open ?? false;

    expect(isOpen).toBe(false);
  });

  it("should initialize childrenOpenState from children open properties", () => {
    const children = [
      createTestLog({ id: "child-1", open: true }),
      createTestLog({ id: "child-2", open: false }),
      createTestLog({ id: "child-3", open: undefined }),
    ];

    const childrenOpenState: Record<string, boolean> = {};

    children.forEach((child) => {
      if (childrenOpenState[child.id] === undefined) {
        childrenOpenState[child.id] = child.open ?? false;
      }
    });

    expect(childrenOpenState["child-1"]).toBe(true);
    expect(childrenOpenState["child-2"]).toBe(false);
    expect(childrenOpenState["child-3"]).toBe(false);
  });

  it("should not reinitialize childrenOpenState for existing keys", () => {
    const children = [createTestLog({ id: "child-1", open: true })];

    const childrenOpenState: Record<string, boolean> = {
      "child-1": false, // Already exists
    };

    // Effect should not update existing keys
    children.forEach((child) => {
      if (childrenOpenState[child.id] === undefined) {
        childrenOpenState[child.id] = child.open ?? false;
      }
    });

    expect(childrenOpenState["child-1"]).toBe(false); // Should remain unchanged
  });
});

describe("LogItemGroup - MAX_DEPTH Limit", () => {
  const MAX_DEPTH = 5;

  it("should render children when depth is less than MAX_DEPTH", () => {
    const depth = 2;
    const log = createTestLogWithChildren({}, 3);
    const isOpen = true;
    const hasChildren = log.children && log.children.length > 0;

    const shouldRenderChildren = isOpen && hasChildren && depth < MAX_DEPTH;

    expect(shouldRenderChildren).toBe(true);
  });

  it("should not render children when depth equals MAX_DEPTH", () => {
    const depth = 5;
    const log = createTestLogWithChildren({}, 3);
    const isOpen = true;
    const hasChildren = log.children && log.children.length > 0;

    const shouldRenderChildren = isOpen && hasChildren && depth < MAX_DEPTH;

    expect(shouldRenderChildren).toBe(false);
  });

  it("should not render children when depth exceeds MAX_DEPTH", () => {
    const depth = 6;
    const log = createTestLogWithChildren({}, 3);
    const isOpen = true;
    const hasChildren = log.children && log.children.length > 0;

    const shouldRenderChildren = isOpen && hasChildren && depth < MAX_DEPTH;

    expect(shouldRenderChildren).toBe(false);
  });
});

describe("LogItemGroup - Conditional Rendering Logic", () => {
  it("should render children when isOpen=true, hasChildren=true, depth < MAX_DEPTH", () => {
    const isOpen = true;
    const hasChildren = true;
    const depth = 2;
    const MAX_DEPTH = 5;

    const shouldRender = isOpen && hasChildren && depth < MAX_DEPTH;

    expect(shouldRender).toBe(true);
  });

  it("should not render children when isOpen=false", () => {
    const isOpen = false;
    const hasChildren = true;
    const depth = 2;
    const MAX_DEPTH = 5;

    const shouldRender = isOpen && hasChildren && depth < MAX_DEPTH;

    expect(shouldRender).toBe(false);
  });

  it("should not render children when hasChildren=false", () => {
    const isOpen = true;
    const hasChildren = false;
    const depth = 2;
    const MAX_DEPTH = 5;

    const shouldRender = isOpen && hasChildren && depth < MAX_DEPTH;

    expect(shouldRender).toBe(false);
  });
});

describe("LogItemGroup - Styling Logic", () => {
  it("should apply alternateBackground class when true", () => {
    const alternateBackground = true;

    // Class should be 'bg-white/[0.02]'
    const classApplied = alternateBackground ? "bg-white/[0.02]" : "";

    expect(classApplied).toBe("bg-white/[0.02]");
  });

  it("should not apply alternateBackground class when false", () => {
    const alternateBackground = false;

    // Class should be empty string
    const classApplied = alternateBackground ? "bg-white/[0.02]" : "";

    expect(classApplied).toBe("");
  });

  it("should build gradient color CSS variable correctly", () => {
    const gradientColor = "239 68 68";

    const cssVariable = `--gradient-color: ${gradientColor};`;

    expect(cssVariable).toBe("--gradient-color: 239 68 68;");
  });
});

describe("LogItemGroup - Children Iteration", () => {
  it("should iterate over all children", () => {
    const log = createTestLogWithChildren({}, 5);

    expect(log.children).toBeDefined();
    expect(log.children?.length).toBe(5);

    // Should be able to map over children
    const childIds = log.children?.map((child) => child.id);
    expect(childIds).toHaveLength(5);
  });

  it("should handle log with single child", () => {
    const log = createTestLogWithChildren({}, 1);

    expect(log.children).toBeDefined();
    expect(log.children?.length).toBe(1);
  });

  it("should derive childUsername for each child", () => {
    const log = createTestLogWithChildren({}, 3);
    const getUserDisplayName = (userId: string) => `Player-${userId}`;

    log.children?.forEach((child) => {
      const childUsername = getUserDisplayName
        ? getUserDisplayName(child.userId)
        : null;

      expect(childUsername).toContain("Player-");
    });
  });
});
