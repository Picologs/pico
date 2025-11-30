import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface AvatarServeOptions {
  uploadDir?: string;
}

export interface AvatarServeResult {
  success: boolean;
  status: number;
  body?: Uint8Array;
  headers?: Record<string, string>;
  error?: string;
}

/**
 * Handle serving avatar image files with comprehensive security validation
 * @param filename - The filename from the URL parameter
 * @param options - Configuration options (uploadDir)
 * @returns Response data with status, body, and headers
 */
export async function handleAvatarServe(
  filename: string,
  options: AvatarServeOptions = {},
): Promise<AvatarServeResult> {
  try {
    const UPLOAD_DIR =
      options.uploadDir || path.join(process.cwd(), "uploads", "avatars");

    // Comprehensive validation to prevent path traversal attacks
    // Check for: null/empty, directory separators, URL-encoded variants, null bytes
    if (
      !filename ||
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\") ||
      filename.includes("%2e") || // URL-encoded .
      filename.includes("%2E") ||
      filename.includes("%2f") || // URL-encoded /
      filename.includes("%2F") ||
      filename.includes("%5c") || // URL-encoded \
      filename.includes("%5C") ||
      filename.includes("\0") || // Null byte
      filename.includes("%00") || // URL-encoded null byte
      !/^[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png|gif|svg)$/i.test(filename) // Whitelist pattern
    ) {
      return {
        success: false,
        status: 400,
        error: "Invalid filename",
      };
    }

    // Use basename for additional safety to strip any path components
    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!existsSync(filePath)) {
      return {
        success: false,
        status: 404,
        error: "File not found",
      };
    }

    const fileBuffer = await readFile(filePath);

    // Determine content type from file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
    };
    const contentType = contentTypeMap[ext] || "application/octet-stream";

    // Convert Buffer to Uint8Array for Response compatibility
    return {
      success: true,
      status: 200,
      body: new Uint8Array(fileBuffer),
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    };
  } catch (error) {
    console.error("File serving error:", error);
    return {
      success: false,
      status: 500,
      error: "Internal server error",
    };
  }
}
