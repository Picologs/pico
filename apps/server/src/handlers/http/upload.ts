import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { db, users } from "../../lib/db";
import { eq } from "drizzle-orm";

// Per-user rate limiting for uploads
const USER_UPLOAD_LIMIT = 10; // Max uploads per window
const USER_UPLOAD_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const userUploadTimestamps = new Map<string, number[]>();

/**
 * Check if user has exceeded upload rate limit
 * @param userId - User ID to check
 * @returns Object with allowed status and remaining uploads
 */
function checkUserUploadLimit(userId: string): {
  allowed: boolean;
  remaining: number;
  resetIn?: number;
} {
  const now = Date.now();
  const windowStart = now - USER_UPLOAD_WINDOW_MS;

  // Get existing timestamps for user
  let timestamps = userUploadTimestamps.get(userId) || [];

  // Filter to only timestamps within the current window
  timestamps = timestamps.filter((ts) => ts > windowStart);

  // Check if limit exceeded
  if (timestamps.length >= USER_UPLOAD_LIMIT) {
    // Find when the oldest timestamp will expire
    const oldestTimestamp = Math.min(...timestamps);
    const resetIn = oldestTimestamp + USER_UPLOAD_WINDOW_MS - now;
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining: USER_UPLOAD_LIMIT - timestamps.length };
}

/**
 * Record an upload for rate limiting
 * @param userId - User ID that performed the upload
 */
function recordUserUpload(userId: string): void {
  const now = Date.now();
  const windowStart = now - USER_UPLOAD_WINDOW_MS;

  // Get existing timestamps and filter to current window
  let timestamps = userUploadTimestamps.get(userId) || [];
  timestamps = timestamps.filter((ts) => ts > windowStart);

  // Add new timestamp
  timestamps.push(now);
  userUploadTimestamps.set(userId, timestamps);

  // Periodic cleanup: Remove users with no recent uploads (every 100 calls)
  if (Math.random() < 0.01) {
    for (const [uid, ts] of userUploadTimestamps.entries()) {
      const validTimestamps = ts.filter((t) => t > windowStart);
      if (validTimestamps.length === 0) {
        userUploadTimestamps.delete(uid);
      }
    }
  }
}

// S3 Client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "auto",
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME!;
const TIGRIS_ENDPOINT = process.env.AWS_ENDPOINT_URL_S3!;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Avatar upload endpoint handler
 * Validates, processes, and uploads avatar images to S3-compatible storage
 *
 * @param req - Request with multipart/form-data containing file
 * @param userId - Authenticated user ID from JWT
 * @returns Response with avatar URL or error
 */
export async function handleUpload(
  req: Request,
  userId: string,
): Promise<Response> {
  try {
    // Parse form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json(
        {
          error: "No file provided",
          details: "Request must include a file field",
        },
        { status: 400 },
      );
    }

    // Verify user exists FIRST - before any file processing
    // This ensures unauthorized users are rejected immediately
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.discordId, userId))
      .limit(1);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Check per-user upload rate limit
    const rateLimit = checkUserUploadLimit(userId);
    if (!rateLimit.allowed) {
      const resetMinutes = Math.ceil((rateLimit.resetIn || 0) / 60000);
      return Response.json(
        {
          error: "Upload rate limit exceeded",
          details: `Maximum ${USER_UPLOAD_LIMIT} uploads per hour. Try again in ${resetMinutes} minutes.`,
        },
        { status: 429 },
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        {
          error: "Invalid file type",
          details: `File must be one of: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        {
          error: "File too large",
          details: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 400 },
      );
    }

    // Convert to buffer for processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check if image is animated (GIF or WebP)
    const metadata = await sharp(buffer).metadata();
    const isAnimated = (metadata.pages ?? 0) > 1;

    // Generate secure filename with user ID for audit trail
    const timestamp = Date.now();
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, "");

    // Determine file extension based on animation
    const extension = isAnimated
      ? file.type === "image/gif"
        ? "gif"
        : "webp"
      : "webp";
    const filename = `${sanitizedUserId}-${timestamp}.${extension}`;

    // Process image with sharp
    let processedImage: Buffer;
    let contentType: string;

    if (isAnimated) {
      // For animated images, resize while preserving all frames
      if (file.type === "image/gif") {
        // Animated GIF → Animated WebP (better compression)
        processedImage = await sharp(buffer, { animated: true })
          .resize(512, 512, {
            fit: "cover",
            position: "center",
          })
          .webp({ quality: 85 })
          .toBuffer();
        contentType = "image/webp";
      } else {
        // Already animated WebP, just resize
        processedImage = await sharp(buffer, { animated: true })
          .resize(512, 512, {
            fit: "cover",
            position: "center",
          })
          .webp({ quality: 85 })
          .toBuffer();
        contentType = "image/webp";
      }
    } else {
      // Static image - standard processing
      processedImage = await sharp(buffer)
        .resize(512, 512, {
          fit: "cover",
          position: "center",
        })
        .webp({ quality: 85 })
        .toBuffer();
      contentType = "image/webp";
    }

    // Upload to Tigris
    // Note: Tigris uses bucket-level public access, not object-level ACLs
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filename,
        Body: processedImage,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000", // 1 year
      }),
    );

    // Record successful upload for rate limiting
    recordUserUpload(userId);

    // Construct public URL using CDN
    const publicUrl = `https://cdn.picologs.com/${filename}`;

    return Response.json(
      {
        success: true,
        url: publicUrl,
        filename,
        size: processedImage.length,
        animated: isAnimated,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[Upload] Error processing upload:", error);
    return Response.json(
      {
        error: "Failed to upload file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
