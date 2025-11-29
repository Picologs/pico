/**
 * Tests for UI notification helpers
 *
 * Tests cover:
 * - normalizeNotification: Function-based and object-based API compatibility
 * - callNotification: Callback invocation with both API styles
 * - Edge cases for notification options
 */

import { describe, it, expect, vi } from "vitest";
import {
  normalizeNotification,
  callNotification,
  type NotificationOptions,
  type NotificationCallback,
} from "./notifications.js";

// ============================================================================
// normalizeNotification Tests
// ============================================================================

describe("normalizeNotification", () => {
  describe("Object-based API", () => {
    it("should handle object with all required fields", () => {
      const options: NotificationOptions = {
        message: "Success!",
        type: "success",
      };

      const result = normalizeNotification(options);

      expect(result).toEqual({
        message: "Success!",
        type: "success",
      });
    });

    it("should handle object with optional customIcon", () => {
      const options: NotificationOptions = {
        message: "Info message",
        type: "info",
        customIcon: "✓",
      };

      const result = normalizeNotification(options);

      expect(result).toEqual({
        message: "Info message",
        type: "info",
        customIcon: "✓",
      });
    });

    it("should handle object with autoDismiss flag", () => {
      const options: NotificationOptions = {
        message: "Error occurred",
        type: "error",
        autoDismiss: false,
      };

      const result = normalizeNotification(options);

      expect(result).toEqual({
        message: "Error occurred",
        type: "error",
        autoDismiss: false,
      });
    });

    it("should handle object with duration", () => {
      const options: NotificationOptions = {
        message: "Custom duration",
        type: "info",
        duration: 3000,
      };

      const result = normalizeNotification(options);

      expect(result).toEqual({
        message: "Custom duration",
        type: "info",
        duration: 3000,
      });
    });

    it("should handle object with all optional fields", () => {
      const options: NotificationOptions = {
        message: "Complete notification",
        type: "success",
        customIcon: "🎉",
        autoDismiss: true,
        duration: 10000,
      };

      const result = normalizeNotification(options);

      expect(result).toEqual({
        message: "Complete notification",
        type: "success",
        customIcon: "🎉",
        autoDismiss: true,
        duration: 10000,
      });
    });
  });

  describe("Function-based API (backward compatibility)", () => {
    it("should handle function-based API with message and type only", () => {
      const result = normalizeNotification("Hello", "success");

      expect(result).toEqual({
        message: "Hello",
        type: "success",
        customIcon: undefined,
        autoDismiss: undefined,
      });
    });

    it("should handle function-based API with customIcon", () => {
      const result = normalizeNotification("Warning!", "error", "⚠️");

      expect(result).toEqual({
        message: "Warning!",
        type: "error",
        customIcon: "⚠️",
        autoDismiss: undefined,
      });
    });

    it("should handle function-based API with autoDismiss", () => {
      const result = normalizeNotification(
        "Auto dismiss",
        "info",
        undefined,
        true,
      );

      expect(result).toEqual({
        message: "Auto dismiss",
        type: "info",
        customIcon: undefined,
        autoDismiss: true,
      });
    });

    it("should handle function-based API with all parameters", () => {
      const result = normalizeNotification("Complete", "success", "✓", false);

      expect(result).toEqual({
        message: "Complete",
        type: "success",
        customIcon: "✓",
        autoDismiss: false,
      });
    });

    it("should handle all notification types", () => {
      expect(normalizeNotification("Success", "success").type).toBe("success");
      expect(normalizeNotification("Error", "error").type).toBe("error");
      expect(normalizeNotification("Info", "info").type).toBe("info");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty message string", () => {
      const result = normalizeNotification("", "info");

      expect(result.message).toBe("");
      expect(result.type).toBe("info");
    });

    it("should handle empty customIcon string", () => {
      const result = normalizeNotification("Test", "info", "");

      expect(result.customIcon).toBe("");
    });

    it("should preserve undefined values", () => {
      const result = normalizeNotification(
        "Test",
        "info",
        undefined,
        undefined,
      );

      expect(result.customIcon).toBeUndefined();
      expect(result.autoDismiss).toBeUndefined();
    });
  });
});

// ============================================================================
// callNotification Tests
// ============================================================================

describe("callNotification", () => {
  describe("Object-based callback", () => {
    it("should call object-based callback with normalized options", () => {
      const callback = vi.fn() as unknown as NotificationCallback;
      const options: NotificationOptions = {
        message: "Test",
        type: "success",
        customIcon: "✓",
      };

      callNotification(callback, options);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(options);
    });

    it("should handle callback with minimal options", () => {
      const callback = vi.fn() as unknown as NotificationCallback;
      const options: NotificationOptions = {
        message: "Minimal",
        type: "info",
      };

      callNotification(callback, options);

      expect(callback).toHaveBeenCalledWith(options);
    });

    it("should handle callback with all options", () => {
      const callback = vi.fn() as unknown as NotificationCallback;
      const options: NotificationOptions = {
        message: "Complete",
        type: "error",
        customIcon: "❌",
        autoDismiss: false,
        duration: 5000,
      };

      callNotification(callback, options);

      expect(callback).toHaveBeenCalledWith(options);
    });
  });

  describe("Function-based callback (fallback)", () => {
    it("should attempt object-based call and fallback on error", () => {
      // The implementation tries object-based first, then falls back
      // This test verifies the fallback mechanism exists
      const calls: string[] = [];

      const callback = ((arg: any) => {
        if (typeof arg === "object") {
          calls.push("object");
          throw new Error("Object-based failed");
        } else {
          calls.push("function");
        }
      }) as NotificationCallback;

      const options: NotificationOptions = {
        message: "Fallback test",
        type: "success",
      };

      callNotification(callback, options);

      // Should have tried object-based first, then function-based
      expect(calls).toContain("object");
      expect(calls).toContain("function");
    });
  });

  describe("Integration with normalizeNotification", () => {
    it("should work with normalized object-based input", () => {
      const callback = vi.fn() as unknown as NotificationCallback;
      const normalized = normalizeNotification({
        message: "Test",
        type: "success",
        customIcon: "✓",
      });

      callNotification(callback, normalized);

      expect(callback).toHaveBeenCalledWith({
        message: "Test",
        type: "success",
        customIcon: "✓",
      });
    });

    it("should work with normalized function-based input", () => {
      const callback = vi.fn() as unknown as NotificationCallback;
      const normalized = normalizeNotification("Test", "error", "❌", false);

      callNotification(callback, normalized);

      expect(callback).toHaveBeenCalledWith({
        message: "Test",
        type: "error",
        customIcon: "❌",
        autoDismiss: false,
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle empty message", () => {
      const callback = vi.fn() as unknown as NotificationCallback;
      const options: NotificationOptions = {
        message: "",
        type: "info",
      };

      callNotification(callback, options);

      expect(callback).toHaveBeenCalledWith(options);
    });

    it("should handle all notification types", () => {
      const callback = vi.fn() as unknown as NotificationCallback;

      callNotification(callback, { message: "Success", type: "success" });
      callNotification(callback, { message: "Error", type: "error" });
      callNotification(callback, { message: "Info", type: "info" });

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it("should handle undefined optional fields", () => {
      const callback = vi.fn() as unknown as NotificationCallback;
      const options: NotificationOptions = {
        message: "Test",
        type: "info",
        customIcon: undefined,
        autoDismiss: undefined,
        duration: undefined,
      };

      callNotification(callback, options);

      expect(callback).toHaveBeenCalledWith(options);
    });
  });
});

// ============================================================================
// Type Compatibility Tests
// ============================================================================

describe("Type Compatibility", () => {
  it("should allow NotificationCallback to accept object-based function", () => {
    const callback: NotificationCallback = (options: NotificationOptions) => {
      expect(options.message).toBeDefined();
      expect(options.type).toBeDefined();
    };

    callNotification(callback, { message: "Test", type: "success" });
  });

  it("should allow NotificationCallback to accept function-based function", () => {
    const callback: NotificationCallback = (
      message: string,
      type: "success" | "error" | "info",
      customIcon?: string,
      autoDismiss?: boolean,
    ) => {
      expect(message).toBeDefined();
      expect(type).toBeDefined();
    };

    callNotification(callback, { message: "Test", type: "success" });
  });

  it("should handle NotificationOptions with partial fields", () => {
    const options: NotificationOptions = {
      message: "Partial",
      type: "info",
    };

    expect(options.customIcon).toBeUndefined();
    expect(options.autoDismiss).toBeUndefined();
    expect(options.duration).toBeUndefined();
  });
});
