import { describe, it, expect } from "vitest";
import {
  calculateTotalPages,
  hasMorePages,
  createPaginationMetadata,
  type PaginationMetadata,
} from "./api/pagination";

describe("pagination helpers", () => {
  describe("calculateTotalPages", () => {
    it("should calculate total pages correctly with even distribution", () => {
      const result = calculateTotalPages(100, 10);
      expect(result).toBe(10);
    });

    it("should calculate total pages with remainder (ceiling behavior)", () => {
      const result = calculateTotalPages(101, 10);
      expect(result).toBe(11);
    });

    it("should return 1 page for single item", () => {
      const result = calculateTotalPages(1, 10);
      expect(result).toBe(1);
    });

    it("should return 1 page when total equals perPage", () => {
      const result = calculateTotalPages(10, 10);
      expect(result).toBe(1);
    });

    it("should return 1 page for zero items", () => {
      const result = calculateTotalPages(0, 10);
      expect(result).toBe(1);
    });

    it("should return 1 page when perPage is 0 (invalid input)", () => {
      const result = calculateTotalPages(100, 0);
      expect(result).toBe(1);
    });

    it("should return 1 page when perPage is negative (invalid input)", () => {
      const result = calculateTotalPages(100, -5);
      expect(result).toBe(1);
    });

    it("should handle very large numbers", () => {
      const result = calculateTotalPages(1000000, 50);
      expect(result).toBe(20000);
    });

    it("should handle very small perPage value", () => {
      const result = calculateTotalPages(100, 1);
      expect(result).toBe(100);
    });

    it("should handle large perPage value", () => {
      const result = calculateTotalPages(100, 1000);
      expect(result).toBe(1);
    });

    it("should handle floating point total (should treat as integer)", () => {
      const result = calculateTotalPages(10.5, 3);
      expect(result).toBe(4);
    });

    it("should handle floating point perPage (should treat as integer)", () => {
      const result = calculateTotalPages(10, 3.5);
      expect(result).toBe(3);
    });

    it("should correctly handle 99 items with 10 perPage", () => {
      const result = calculateTotalPages(99, 10);
      expect(result).toBe(10);
    });

    it("should correctly handle 100 items with 10 perPage", () => {
      const result = calculateTotalPages(100, 10);
      expect(result).toBe(10);
    });

    it("should correctly handle 101 items with 10 perPage", () => {
      const result = calculateTotalPages(101, 10);
      expect(result).toBe(11);
    });
  });

  describe("hasMorePages", () => {
    it("should return true when current page is less than total pages", () => {
      const result = hasMorePages(1, 5);
      expect(result).toBe(true);
    });

    it("should return false when on last page", () => {
      const result = hasMorePages(5, 5);
      expect(result).toBe(false);
    });

    it("should return false when current page equals total pages", () => {
      const result = hasMorePages(10, 10);
      expect(result).toBe(false);
    });

    it("should return true when on first page of multiple pages", () => {
      const result = hasMorePages(1, 10);
      expect(result).toBe(true);
    });

    it("should return true when on middle page", () => {
      const result = hasMorePages(5, 10);
      expect(result).toBe(true);
    });

    it("should return true when one page away from last", () => {
      const result = hasMorePages(9, 10);
      expect(result).toBe(true);
    });

    it("should handle edge case with single page", () => {
      const result = hasMorePages(1, 1);
      expect(result).toBe(false);
    });

    it("should handle large page numbers", () => {
      const result = hasMorePages(999, 1000);
      expect(result).toBe(true);
    });

    it("should handle large page numbers at boundary", () => {
      const result = hasMorePages(1000, 1000);
      expect(result).toBe(false);
    });
  });

  describe("createPaginationMetadata", () => {
    it("should create correct metadata for first page", () => {
      const result = createPaginationMetadata(1, 10, 100);

      expect(result).toEqual({
        page: 1,
        perPage: 10,
        total: 100,
        totalPages: 10,
        hasMore: true,
      });
    });

    it("should create correct metadata for middle page", () => {
      const result = createPaginationMetadata(5, 10, 100);

      expect(result).toEqual({
        page: 5,
        perPage: 10,
        total: 100,
        totalPages: 10,
        hasMore: true,
      });
    });

    it("should create correct metadata for last page", () => {
      const result = createPaginationMetadata(10, 10, 100);

      expect(result).toEqual({
        page: 10,
        perPage: 10,
        total: 100,
        totalPages: 10,
        hasMore: false,
      });
    });

    it("should create correct metadata for single page result", () => {
      const result = createPaginationMetadata(1, 10, 5);

      expect(result).toEqual({
        page: 1,
        perPage: 10,
        total: 5,
        totalPages: 1,
        hasMore: false,
      });
    });

    it("should create correct metadata for empty results", () => {
      const result = createPaginationMetadata(1, 10, 0);

      expect(result).toEqual({
        page: 1,
        perPage: 10,
        total: 0,
        totalPages: 1,
        hasMore: false,
      });
    });

    it("should return object of type PaginationMetadata", () => {
      const result = createPaginationMetadata(1, 10, 100);

      expect(result).toHaveProperty("page");
      expect(result).toHaveProperty("perPage");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("totalPages");
      expect(result).toHaveProperty("hasMore");
    });

    it("should have correct property types", () => {
      const result = createPaginationMetadata(1, 10, 100);

      expect(typeof result.page).toBe("number");
      expect(typeof result.perPage).toBe("number");
      expect(typeof result.total).toBe("number");
      expect(typeof result.totalPages).toBe("number");
      expect(typeof result.hasMore).toBe("boolean");
    });

    it("should handle large datasets", () => {
      const result = createPaginationMetadata(50, 20, 1000);

      expect(result).toEqual({
        page: 50,
        perPage: 20,
        total: 1000,
        totalPages: 50,
        hasMore: false,
      });
    });

    it("should handle small perPage with large total", () => {
      const result = createPaginationMetadata(1, 1, 1000);

      expect(result).toEqual({
        page: 1,
        perPage: 1,
        total: 1000,
        totalPages: 1000,
        hasMore: true,
      });
    });

    it("should handle invalid perPage (0) gracefully", () => {
      const result = createPaginationMetadata(1, 0, 100);

      expect(result.totalPages).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it("should handle invalid perPage (negative) gracefully", () => {
      const result = createPaginationMetadata(1, -10, 100);

      expect(result.totalPages).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it("should handle pagination with remainder", () => {
      const result = createPaginationMetadata(3, 10, 25);

      expect(result).toEqual({
        page: 3,
        perPage: 10,
        total: 25,
        totalPages: 3,
        hasMore: false,
      });
    });

    it("should handle second to last page with remainder", () => {
      const result = createPaginationMetadata(2, 10, 25);

      expect(result).toEqual({
        page: 2,
        perPage: 10,
        total: 25,
        totalPages: 3,
        hasMore: true,
      });
    });

    it("should preserve exact input values in metadata", () => {
      const page = 7;
      const perPage = 25;
      const total = 500;
      const result = createPaginationMetadata(page, perPage, total);

      expect(result.page).toBe(page);
      expect(result.perPage).toBe(perPage);
      expect(result.total).toBe(total);
    });

    it("should handle beyond last page scenario", () => {
      const result = createPaginationMetadata(11, 10, 100);

      expect(result).toEqual({
        page: 11,
        perPage: 10,
        total: 100,
        totalPages: 10,
        hasMore: false,
      });
    });
  });

  describe("pagination consistency", () => {
    it("should maintain consistency between helper functions", () => {
      const page = 1;
      const perPage = 10;
      const total = 100;

      const totalPages = calculateTotalPages(total, perPage);
      const hasMore = hasMorePages(page, totalPages);
      const metadata = createPaginationMetadata(page, perPage, total);

      expect(metadata.totalPages).toBe(totalPages);
      expect(metadata.hasMore).toBe(hasMore);
    });

    it("should maintain consistency for last page", () => {
      const page = 10;
      const perPage = 10;
      const total = 100;

      const totalPages = calculateTotalPages(total, perPage);
      const hasMore = hasMorePages(page, totalPages);
      const metadata = createPaginationMetadata(page, perPage, total);

      expect(metadata.totalPages).toBe(totalPages);
      expect(metadata.hasMore).toBe(hasMore);
      expect(metadata.hasMore).toBe(false);
    });

    it("should maintain consistency for partial last page", () => {
      const page = 3;
      const perPage = 10;
      const total = 25;

      const totalPages = calculateTotalPages(total, perPage);
      const hasMore = hasMorePages(page, totalPages);
      const metadata = createPaginationMetadata(page, perPage, total);

      expect(metadata.totalPages).toBe(totalPages);
      expect(metadata.hasMore).toBe(hasMore);
      expect(metadata.hasMore).toBe(false);
    });
  });
});
