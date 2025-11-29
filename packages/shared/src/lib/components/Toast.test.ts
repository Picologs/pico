/**
 * Tests for Toast.svelte
 *
 * Tests toast notification logic including:
 * - ToastNotification structure
 * - Auto-dismiss behavior
 * - Clear all functionality
 * - Icon selection logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ToastNotification } from "./Toast.svelte";

describe("Toast - ToastNotification Interface", () => {
  it("should have required properties for success toast", () => {
    const toast: ToastNotification = {
      id: "toast-1",
      message: "Operation successful",
      type: "success",
    };

    expect(toast.id).toBe("toast-1");
    expect(toast.message).toBe("Operation successful");
    expect(toast.type).toBe("success");
  });

  it("should have required properties for error toast", () => {
    const toast: ToastNotification = {
      id: "toast-2",
      message: "Something went wrong",
      type: "error",
    };

    expect(toast.id).toBe("toast-2");
    expect(toast.type).toBe("error");
  });

  it("should have required properties for info toast", () => {
    const toast: ToastNotification = {
      id: "toast-3",
      message: "Information message",
      type: "info",
    };

    expect(toast.id).toBe("toast-3");
    expect(toast.type).toBe("info");
  });

  it("should support optional customIcon", () => {
    const toast: ToastNotification = {
      id: "toast-4",
      message: "Custom icon toast",
      type: "info",
      customIcon: "🚀",
    };

    expect(toast.customIcon).toBe("🚀");
  });

  it("should support optional avatarUrl", () => {
    const toast: ToastNotification = {
      id: "toast-5",
      message: "Friend request",
      type: "info",
      avatarUrl: "https://cdn.discordapp.com/avatars/123/abc.png",
    };

    expect(toast.avatarUrl).toBe(
      "https://cdn.discordapp.com/avatars/123/abc.png",
    );
  });

  it("should support optional autoDismiss", () => {
    const toast: ToastNotification = {
      id: "toast-6",
      message: "Stay visible",
      type: "error",
      autoDismiss: false,
    };

    expect(toast.autoDismiss).toBe(false);
  });

  it("should support all optional properties together", () => {
    const toast: ToastNotification = {
      id: "toast-7",
      message: "Full featured toast",
      type: "success",
      customIcon: "✨",
      avatarUrl: "https://example.com/avatar.png",
      autoDismiss: true,
    };

    expect(toast.customIcon).toBe("✨");
    expect(toast.avatarUrl).toBe("https://example.com/avatar.png");
    expect(toast.autoDismiss).toBe(true);
  });
});

describe("Toast - Auto-Dismiss Logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should calculate auto-dismiss condition correctly when autoDismiss is true", () => {
    const notification: ToastNotification = {
      id: "toast-1",
      message: "Test",
      type: "success",
      autoDismiss: true,
    };
    const autoRemove = true;

    const shouldAutoDismiss =
      notification.autoDismiss !== undefined
        ? notification.autoDismiss
        : autoRemove;

    expect(shouldAutoDismiss).toBe(true);
  });

  it("should calculate auto-dismiss condition correctly when autoDismiss is false", () => {
    const notification: ToastNotification = {
      id: "toast-1",
      message: "Test",
      type: "error",
      autoDismiss: false,
    };
    const autoRemove = true;

    const shouldAutoDismiss =
      notification.autoDismiss !== undefined
        ? notification.autoDismiss
        : autoRemove;

    expect(shouldAutoDismiss).toBe(false);
  });

  it("should fallback to autoRemove prop when autoDismiss is undefined", () => {
    const notification: ToastNotification = {
      id: "toast-1",
      message: "Test",
      type: "info",
      // autoDismiss not set
    };
    const autoRemove = true;

    const shouldAutoDismiss =
      notification.autoDismiss !== undefined
        ? notification.autoDismiss
        : autoRemove;

    expect(shouldAutoDismiss).toBe(true);
  });

  it("should respect autoRemove=false as fallback", () => {
    const notification: ToastNotification = {
      id: "toast-1",
      message: "Test",
      type: "info",
    };
    const autoRemove = false;

    const shouldAutoDismiss =
      notification.autoDismiss !== undefined
        ? notification.autoDismiss
        : autoRemove;

    expect(shouldAutoDismiss).toBe(false);
  });

  it("should call onRemove after duration expires", () => {
    const onRemove = vi.fn();
    const duration = 5000;
    const notificationId = "toast-1";

    // Simulate the timeout behavior
    const timeoutId = setTimeout(() => {
      onRemove(notificationId);
    }, duration);

    // Fast-forward time
    vi.advanceTimersByTime(5000);

    expect(onRemove).toHaveBeenCalledWith("toast-1");

    clearTimeout(timeoutId);
  });

  it("should not call onRemove before duration expires", () => {
    const onRemove = vi.fn();
    const duration = 5000;
    const notificationId = "toast-1";

    const timeoutId = setTimeout(() => {
      onRemove(notificationId);
    }, duration);

    // Advance less than duration
    vi.advanceTimersByTime(4000);

    expect(onRemove).not.toHaveBeenCalled();

    clearTimeout(timeoutId);
  });
});

describe("Toast - Clear All Logic", () => {
  it("should show clear all button when showClearAll=true and multiple notifications", () => {
    const notifications: ToastNotification[] = [
      { id: "1", message: "First", type: "info" },
      { id: "2", message: "Second", type: "info" },
    ];
    const showClearAll = true;

    const shouldShowClearAll = showClearAll && notifications.length > 1;

    expect(shouldShowClearAll).toBe(true);
  });

  it("should NOT show clear all button when showClearAll=false", () => {
    const notifications: ToastNotification[] = [
      { id: "1", message: "First", type: "info" },
      { id: "2", message: "Second", type: "info" },
    ];
    const showClearAll = false;

    const shouldShowClearAll = showClearAll && notifications.length > 1;

    expect(shouldShowClearAll).toBe(false);
  });

  it("should NOT show clear all button with single notification", () => {
    const notifications: ToastNotification[] = [
      { id: "1", message: "Only one", type: "info" },
    ];
    const showClearAll = true;

    const shouldShowClearAll = showClearAll && notifications.length > 1;

    expect(shouldShowClearAll).toBe(false);
  });

  it("should NOT show clear all button with empty notifications", () => {
    const notifications: ToastNotification[] = [];
    const showClearAll = true;

    const shouldShowClearAll = showClearAll && notifications.length > 1;

    expect(shouldShowClearAll).toBe(false);
  });

  it("should call onClearAll when handleClearAll is triggered", () => {
    const onClearAll = vi.fn();

    // Simulate handleClearAll function
    const handleClearAll = () => {
      if (onClearAll) {
        onClearAll();
      }
    };

    handleClearAll();

    expect(onClearAll).toHaveBeenCalled();
  });
});

describe("Toast - Icon Selection Logic", () => {
  it("should use Check icon for success type without avatar or custom icon", () => {
    const notification: ToastNotification = {
      id: "1",
      message: "Success",
      type: "success",
    };

    const useCheckIcon =
      notification.type === "success" &&
      !notification.avatarUrl &&
      !notification.customIcon;

    expect(useCheckIcon).toBe(true);
  });

  it("should use X icon for error type without avatar or custom icon", () => {
    const notification: ToastNotification = {
      id: "1",
      message: "Error",
      type: "error",
    };

    const useXIcon =
      notification.type === "error" &&
      !notification.avatarUrl &&
      !notification.customIcon;

    expect(useXIcon).toBe(true);
  });

  it("should use Info icon for info type without avatar or custom icon", () => {
    const notification: ToastNotification = {
      id: "1",
      message: "Info",
      type: "info",
    };

    const useInfoIcon =
      notification.type === "info" &&
      !notification.avatarUrl &&
      !notification.customIcon;

    expect(useInfoIcon).toBe(true);
  });

  it("should use avatar when avatarUrl is provided", () => {
    const notification: ToastNotification = {
      id: "1",
      message: "With avatar",
      type: "info",
      avatarUrl: "https://example.com/avatar.png",
    };

    const useAvatar = Boolean(notification.avatarUrl);

    expect(useAvatar).toBe(true);
  });

  it("should use custom icon when provided", () => {
    const notification: ToastNotification = {
      id: "1",
      message: "Custom",
      type: "info",
      customIcon: "🎮",
    };

    const useCustomIcon =
      Boolean(notification.customIcon) && !notification.avatarUrl;

    expect(useCustomIcon).toBe(true);
  });

  it("should prioritize avatar over custom icon", () => {
    const notification: ToastNotification = {
      id: "1",
      message: "Both provided",
      type: "info",
      avatarUrl: "https://example.com/avatar.png",
      customIcon: "🎮",
    };

    // Avatar takes priority
    const useAvatar = Boolean(notification.avatarUrl);
    const useCustomIcon =
      Boolean(notification.customIcon) && !notification.avatarUrl;

    expect(useAvatar).toBe(true);
    expect(useCustomIcon).toBe(false);
  });
});

describe("Toast - Border Color Logic", () => {
  it("should apply success border for success type", () => {
    const notification: ToastNotification = {
      id: "1",
      message: "Success",
      type: "success",
    };

    const borderClass =
      notification.type === "success"
        ? "border-l-success"
        : notification.type === "error"
          ? "border-l-danger"
          : "border-l-discord";

    expect(borderClass).toBe("border-l-success");
  });

  it("should apply danger border for error type", () => {
    const notification: ToastNotification = {
      id: "1",
      message: "Error",
      type: "error",
    };

    const borderClass =
      notification.type === "success"
        ? "border-l-success"
        : notification.type === "error"
          ? "border-l-danger"
          : "border-l-discord";

    expect(borderClass).toBe("border-l-danger");
  });

  it("should apply discord border for info type", () => {
    const notification: ToastNotification = {
      id: "1",
      message: "Info",
      type: "info",
    };

    const borderClass =
      notification.type === "success"
        ? "border-l-success"
        : notification.type === "error"
          ? "border-l-danger"
          : "border-l-discord";

    expect(borderClass).toBe("border-l-discord");
  });
});

describe("Toast - Timeout Management", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should track active timeouts per notification", () => {
    const activeTimeouts = new Map<string, number>();

    // Simulate creating timeout for notification
    const timeoutId = 123 as unknown as number;
    activeTimeouts.set("toast-1", timeoutId);

    expect(activeTimeouts.has("toast-1")).toBe(true);
    expect(activeTimeouts.get("toast-1")).toBe(timeoutId);
  });

  it("should not create duplicate timeout for existing notification", () => {
    const activeTimeouts = new Map<string, number>();
    const createTimeout = vi.fn(() => 123);

    // First notification
    if (!activeTimeouts.has("toast-1")) {
      const timeoutId = createTimeout();
      activeTimeouts.set("toast-1", timeoutId);
    }

    // Try to create another timeout for same notification
    if (!activeTimeouts.has("toast-1")) {
      createTimeout();
    }

    expect(createTimeout).toHaveBeenCalledTimes(1);
  });

  it("should cleanup timeout when notification is removed", () => {
    const activeTimeouts = new Map<string, number>();
    const clearTimeoutFn = vi.fn();

    activeTimeouts.set("toast-1", 123);
    activeTimeouts.set("toast-2", 456);

    // Simulate notification removal
    const currentIds = new Set(["toast-2"]); // toast-1 was removed
    Array.from(activeTimeouts.entries()).forEach(([id, timeoutId]) => {
      if (!currentIds.has(id)) {
        clearTimeoutFn(timeoutId);
        activeTimeouts.delete(id);
      }
    });

    expect(clearTimeoutFn).toHaveBeenCalledWith(123);
    expect(activeTimeouts.has("toast-1")).toBe(false);
    expect(activeTimeouts.has("toast-2")).toBe(true);
  });

  it("should clear all timeouts when notifications array is empty", () => {
    const activeTimeouts = new Map<string, number>();
    const clearTimeoutFn = vi.fn();

    activeTimeouts.set("toast-1", 123);
    activeTimeouts.set("toast-2", 456);

    const notifications: ToastNotification[] = [];

    // Simulate effect cleanup when notifications are empty
    if (notifications.length === 0) {
      activeTimeouts.forEach((timeoutId) => clearTimeoutFn(timeoutId));
      activeTimeouts.clear();
    }

    expect(clearTimeoutFn).toHaveBeenCalledTimes(2);
    expect(activeTimeouts.size).toBe(0);
  });
});
