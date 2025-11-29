/**
 * Comprehensive tests for friend code utility functions
 *
 * Testing all functions in friendCode.ts for 100% coverage:
 * - generateFriendCode()
 * - generateUniqueFriendCodeAsync()
 * - isValidFriendCode()
 * - normalizeFriendCode()
 * - generateUniqueFriendCode()
 */

import { describe, it, expect, vi } from "vitest";
import {
  generateFriendCode,
  generateUniqueFriendCodeAsync,
  isValidFriendCode,
  normalizeFriendCode,
  generateUniqueFriendCode,
} from "./friendCode";

describe("generateFriendCode", () => {
  it("should generate a 6-character code", () => {
    const code = generateFriendCode();
    expect(code).toHaveLength(6);
  });

  it("should only contain uppercase letters and digits", () => {
    const code = generateFriendCode();
    expect(code).toMatch(/^[A-Z0-9]+$/);
  });

  it("should generate different codes on repeated calls (randomness)", () => {
    const codes = new Set<string>();
    // Generate 100 codes - statistically very unlikely to have duplicates
    for (let i = 0; i < 100; i++) {
      codes.add(generateFriendCode());
    }
    // We expect at least 95 unique codes out of 100 (allowing some randomness)
    expect(codes.size).toBeGreaterThan(95);
  });

  it("should use only characters from the valid character set", () => {
    const validChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const code = generateFriendCode();
    for (const char of code) {
      expect(validChars).toContain(char);
    }
  });

  it("should never contain lowercase letters", () => {
    // Generate multiple codes to ensure consistency
    for (let i = 0; i < 50; i++) {
      const code = generateFriendCode();
      expect(code).not.toMatch(/[a-z]/);
    }
  });

  it("should never contain special characters", () => {
    // Generate multiple codes to ensure consistency
    for (let i = 0; i < 50; i++) {
      const code = generateFriendCode();
      expect(code).not.toMatch(/[^A-Z0-9]/);
    }
  });
});

describe("generateUniqueFriendCodeAsync", () => {
  it("should return a unique code when checkExists returns false", async () => {
    const checkExists = vi.fn().mockResolvedValue(false);
    const code = await generateUniqueFriendCodeAsync(checkExists);

    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]+$/);
    expect(checkExists).toHaveBeenCalledWith(code);
    expect(checkExists).toHaveBeenCalledTimes(1);
  });

  it("should retry when first code already exists", async () => {
    const checkExists = vi
      .fn()
      .mockResolvedValueOnce(true) // First code exists
      .mockResolvedValueOnce(false); // Second code is unique

    const code = await generateUniqueFriendCodeAsync(checkExists);

    expect(code).toHaveLength(6);
    expect(checkExists).toHaveBeenCalledTimes(2);
  });

  it("should handle multiple collisions before finding unique code", async () => {
    const checkExists = vi
      .fn()
      .mockResolvedValueOnce(true) // First attempt fails
      .mockResolvedValueOnce(true) // Second attempt fails
      .mockResolvedValueOnce(true) // Third attempt fails
      .mockResolvedValueOnce(false); // Fourth attempt succeeds

    const code = await generateUniqueFriendCodeAsync(checkExists);

    expect(code).toHaveLength(6);
    expect(checkExists).toHaveBeenCalledTimes(4);
  });

  it("should throw error after maxAttempts exhausted with default value", async () => {
    const checkExists = vi.fn().mockResolvedValue(true); // Always returns true

    await expect(generateUniqueFriendCodeAsync(checkExists)).rejects.toThrow(
      "Failed to generate unique friend code after 100 attempts",
    );

    expect(checkExists).toHaveBeenCalledTimes(100);
  });

  it("should throw error after custom maxAttempts exhausted", async () => {
    const checkExists = vi.fn().mockResolvedValue(true);
    const maxAttempts = 5;

    await expect(
      generateUniqueFriendCodeAsync(checkExists, maxAttempts),
    ).rejects.toThrow("Failed to generate unique friend code after 5 attempts");

    expect(checkExists).toHaveBeenCalledTimes(5);
  });

  it("should respect custom maxAttempts parameter", async () => {
    const checkExists = vi.fn().mockResolvedValue(false);
    const maxAttempts = 3;

    const code = await generateUniqueFriendCodeAsync(checkExists, maxAttempts);

    expect(code).toHaveLength(6);
    expect(checkExists).toHaveBeenCalledTimes(1);
  });

  it("should pass generated codes to checkExists function", async () => {
    const checkExists = vi.fn().mockResolvedValue(false);

    const code = await generateUniqueFriendCodeAsync(checkExists);

    expect(checkExists).toHaveBeenCalledWith(code);
    // Verify the argument matches friend code format
    const calledWith = checkExists.mock.calls[0][0];
    expect(calledWith).toHaveLength(6);
    expect(calledWith).toMatch(/^[A-Z0-9]+$/);
  });

  it("should work with async checkExists that has delays", async () => {
    const checkExists = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return false;
    });

    const code = await generateUniqueFriendCodeAsync(checkExists);

    expect(code).toHaveLength(6);
    expect(checkExists).toHaveBeenCalledTimes(1);
  });

  it("should handle checkExists that throws errors", async () => {
    const checkExists = vi.fn().mockRejectedValue(new Error("Database error"));

    await expect(generateUniqueFriendCodeAsync(checkExists)).rejects.toThrow(
      "Database error",
    );
  });

  it("should succeed on last attempt when maxAttempts is reached", async () => {
    const maxAttempts = 3;
    const checkExists = vi
      .fn()
      .mockResolvedValueOnce(true) // Attempt 1 fails
      .mockResolvedValueOnce(true) // Attempt 2 fails
      .mockResolvedValueOnce(false); // Attempt 3 succeeds

    const code = await generateUniqueFriendCodeAsync(checkExists, maxAttempts);

    expect(code).toHaveLength(6);
    expect(checkExists).toHaveBeenCalledTimes(3);
  });
});

describe("isValidFriendCode", () => {
  describe("valid codes", () => {
    it("should return true for valid 6-character uppercase alphanumeric code", () => {
      expect(isValidFriendCode("ABC123")).toBe(true);
    });

    it("should return true for all uppercase letters", () => {
      expect(isValidFriendCode("ABCDEF")).toBe(true);
    });

    it("should return true for all digits", () => {
      expect(isValidFriendCode("123456")).toBe(true);
    });

    it("should return true for mixed letters and numbers", () => {
      expect(isValidFriendCode("A1B2C3")).toBe(true);
      expect(isValidFriendCode("XYZ789")).toBe(true);
      expect(isValidFriendCode("9K3L2M")).toBe(true);
    });
  });

  describe("invalid codes - length", () => {
    it("should return false for codes shorter than 6 characters", () => {
      expect(isValidFriendCode("ABC12")).toBe(false);
      expect(isValidFriendCode("ABC1")).toBe(false);
      expect(isValidFriendCode("ABC")).toBe(false);
      expect(isValidFriendCode("A")).toBe(false);
    });

    it("should return false for codes longer than 6 characters", () => {
      expect(isValidFriendCode("ABC1234")).toBe(false);
      expect(isValidFriendCode("ABCDEFG")).toBe(false);
      expect(isValidFriendCode("ABC123XYZ")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isValidFriendCode("")).toBe(false);
    });
  });

  describe("invalid codes - character set", () => {
    it("should return false for lowercase letters", () => {
      expect(isValidFriendCode("abc123")).toBe(false);
      expect(isValidFriendCode("Abc123")).toBe(false);
      expect(isValidFriendCode("ABC12a")).toBe(false);
    });

    it("should return false for special characters", () => {
      expect(isValidFriendCode("ABC@23")).toBe(false);
      expect(isValidFriendCode("ABC-23")).toBe(false);
      expect(isValidFriendCode("ABC_23")).toBe(false);
      expect(isValidFriendCode("ABC!23")).toBe(false);
      expect(isValidFriendCode("ABC#23")).toBe(false);
    });

    it("should return false for codes with spaces", () => {
      expect(isValidFriendCode("ABC 123")).toBe(false);
      expect(isValidFriendCode(" ABC123")).toBe(false);
      expect(isValidFriendCode("ABC123 ")).toBe(false);
    });

    it("should return false for codes with whitespace characters", () => {
      expect(isValidFriendCode("ABC\t23")).toBe(false);
      expect(isValidFriendCode("ABC\n23")).toBe(false);
      expect(isValidFriendCode("ABC\r23")).toBe(false);
    });

    it("should return false for codes with symbols", () => {
      expect(isValidFriendCode("ABC.23")).toBe(false);
      expect(isValidFriendCode("ABC,23")).toBe(false);
      expect(isValidFriendCode("ABC;23")).toBe(false);
      expect(isValidFriendCode("ABC:23")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle codes at boundaries of character set", () => {
      expect(isValidFriendCode("AAAAAA")).toBe(true);
      expect(isValidFriendCode("ZZZZZZ")).toBe(true);
      expect(isValidFriendCode("000000")).toBe(true);
      expect(isValidFriendCode("999999")).toBe(true);
    });

    it("should be case-sensitive", () => {
      expect(isValidFriendCode("ABCDEF")).toBe(true);
      expect(isValidFriendCode("abcdef")).toBe(false);
      expect(isValidFriendCode("AbCdEf")).toBe(false);
    });
  });
});

describe("normalizeFriendCode", () => {
  it("should convert lowercase letters to uppercase", () => {
    expect(normalizeFriendCode("abc123")).toBe("ABC123");
  });

  it("should convert mixed case to uppercase", () => {
    expect(normalizeFriendCode("AbC123")).toBe("ABC123");
    expect(normalizeFriendCode("aBc123")).toBe("ABC123");
  });

  it("should leave uppercase letters unchanged", () => {
    expect(normalizeFriendCode("ABC123")).toBe("ABC123");
  });

  it("should leave digits unchanged", () => {
    expect(normalizeFriendCode("123456")).toBe("123456");
  });

  it("should handle all lowercase", () => {
    expect(normalizeFriendCode("abcdef")).toBe("ABCDEF");
  });

  it("should handle all uppercase", () => {
    expect(normalizeFriendCode("ABCDEF")).toBe("ABCDEF");
  });

  it("should handle empty string", () => {
    expect(normalizeFriendCode("")).toBe("");
  });

  it("should preserve special characters (not validate)", () => {
    // Note: This function only normalizes, doesn't validate
    expect(normalizeFriendCode("abc@23")).toBe("ABC@23");
    expect(normalizeFriendCode("abc-23")).toBe("ABC-23");
  });

  it("should preserve whitespace (not trim)", () => {
    // Note: This function only normalizes, doesn't trim
    expect(normalizeFriendCode(" abc123")).toBe(" ABC123");
    expect(normalizeFriendCode("abc123 ")).toBe("ABC123 ");
    expect(normalizeFriendCode(" abc123 ")).toBe(" ABC123 ");
  });

  it("should handle very long strings", () => {
    expect(normalizeFriendCode("abcdefghij")).toBe("ABCDEFGHIJ");
  });

  it("should handle single character", () => {
    expect(normalizeFriendCode("a")).toBe("A");
    expect(normalizeFriendCode("z")).toBe("Z");
    expect(normalizeFriendCode("1")).toBe("1");
  });
});

describe("generateUniqueFriendCode (database wrapper)", () => {
  it("should generate unique code using database check", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // Empty array = doesn't exist
    };

    const mockUsersTable = {
      friendCode: "friendCode",
    };

    const mockEq = vi.fn();

    const code = await generateUniqueFriendCode(mockDb, mockUsersTable, mockEq);

    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]+$/);
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalledWith(mockUsersTable);
    expect(mockEq).toHaveBeenCalled();
  });

  it("should retry when code exists in database", async () => {
    let callCount = 0;
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(async () => {
        callCount++;
        // First call returns existing record, second call returns empty
        return callCount === 1 ? [{ friendCode: "ABC123" }] : [];
      }),
    };

    const mockUsersTable = {
      friendCode: "friendCode",
    };

    const mockEq = vi.fn();

    const code = await generateUniqueFriendCode(mockDb, mockUsersTable, mockEq);

    expect(code).toHaveLength(6);
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it("should throw error after max attempts with database", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ friendCode: "EXISTING" }]), // Always exists
    };

    const mockUsersTable = {
      friendCode: "friendCode",
    };

    const mockEq = vi.fn();

    await expect(
      generateUniqueFriendCode(mockDb, mockUsersTable, mockEq),
    ).rejects.toThrow(
      "Failed to generate unique friend code after 100 attempts",
    );
  });

  it("should pass correct parameters to eq function", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };

    const mockUsersTable = {
      friendCode: "friendCode",
    };

    const mockEq = vi.fn();

    await generateUniqueFriendCode(mockDb, mockUsersTable, mockEq);

    // eq should be called with the friendCode field and a generated code
    expect(mockEq).toHaveBeenCalledTimes(1);
    const [field, code] = mockEq.mock.calls[0];
    expect(field).toBe(mockUsersTable.friendCode);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("should handle database errors gracefully", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error("Database connection failed")),
    };

    const mockUsersTable = {
      friendCode: "friendCode",
    };

    const mockEq = vi.fn();

    await expect(
      generateUniqueFriendCode(mockDb, mockUsersTable, mockEq),
    ).rejects.toThrow("Database connection failed");
  });
});

describe("integration tests", () => {
  it("should generate valid codes that pass validation", () => {
    // Generate 50 codes and verify all pass validation
    for (let i = 0; i < 50; i++) {
      const code = generateFriendCode();
      expect(isValidFriendCode(code)).toBe(true);
    }
  });

  it("should normalize and then validate successfully", () => {
    const lowercaseCode = "abc123";
    const normalized = normalizeFriendCode(lowercaseCode);
    expect(isValidFriendCode(normalized)).toBe(true);
  });

  it("should work with full user input flow", async () => {
    // Simulate user entering lowercase code
    const userInput = "xyz789";

    // Normalize it
    const normalized = normalizeFriendCode(userInput);
    expect(normalized).toBe("XYZ789");

    // Validate it
    expect(isValidFriendCode(normalized)).toBe(true);

    // Check if exists (simulate database check)
    const existingCodes = new Set(["ABC123", "DEF456"]);
    const checkExists = async (code: string) => existingCodes.has(code);

    const exists = await checkExists(normalized);
    expect(exists).toBe(false);
  });

  it("should generate unique codes that are different from each other", async () => {
    const existingCodes = new Set<string>();

    // Simulate generating 10 unique codes
    for (let i = 0; i < 10; i++) {
      const checkExists = async (code: string) => existingCodes.has(code);
      const code = await generateUniqueFriendCodeAsync(checkExists);

      expect(existingCodes.has(code)).toBe(false);
      existingCodes.add(code);
      expect(isValidFriendCode(code)).toBe(true);
    }

    expect(existingCodes.size).toBe(10);
  });
});

describe("constants and format verification", () => {
  it("should use 6 as the friend code length", () => {
    const code = generateFriendCode();
    expect(code.length).toBe(6);
  });

  it("should use uppercase letters A-Z and digits 0-9", () => {
    const validCharPattern = /^[A-Z0-9]+$/;
    for (let i = 0; i < 100; i++) {
      const code = generateFriendCode();
      expect(code).toMatch(validCharPattern);
    }
  });

  it("should have 36 possible characters (26 letters + 10 digits)", () => {
    // Generate many codes and collect all unique characters
    const allChars = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const code = generateFriendCode();
      for (const char of code) {
        allChars.add(char);
      }
    }

    // Should have most if not all 36 characters represented
    // With 1000 codes (6000 characters), we expect to see all 36
    expect(allChars.size).toBeGreaterThan(30); // Allow some statistical variance
  });
});
