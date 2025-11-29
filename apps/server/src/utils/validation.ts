import { MAX_METADATA_SIZE } from "../config/constants";

/**
 * Validate userId: string, 1-256 chars, alphanumeric + dashes + underscores
 */
export function isValidUserId(userId: string): boolean {
  if (typeof userId !== "string" || userId.length < 1 || userId.length > 256) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(userId);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  if (typeof uuid !== "string") {
    return false;
  }
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize metadata to prevent prototype pollution and validate size
 */
export function sanitizeMetadata(metadata: any): Record<string, any> | null {
  // Prevent prototype pollution and validate metadata
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  // Check size
  const metadataStr = JSON.stringify(metadata);
  if (metadataStr.length > MAX_METADATA_SIZE) {
    return null;
  }

  // Create clean object without prototype pollution
  const sanitized: Record<string, any> = Object.create(null);
  const dangerousKeys = ["__proto__", "constructor", "prototype"];

  for (const key of Object.keys(metadata)) {
    if (dangerousKeys.includes(key.toLowerCase())) {
      continue; // Skip dangerous keys
    }

    const value = metadata[key];
    // Only allow primitive types and simple objects
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      // Recursively sanitize nested objects (one level deep only)
      const nestedSanitized = Object.create(null);
      for (const nestedKey of Object.keys(value)) {
        if (!dangerousKeys.includes(nestedKey.toLowerCase())) {
          const nestedValue = value[nestedKey];
          if (
            typeof nestedValue === "string" ||
            typeof nestedValue === "number" ||
            typeof nestedValue === "boolean"
          ) {
            nestedSanitized[nestedKey] = nestedValue;
          }
        }
      }
      sanitized[key] = nestedSanitized;
    }
  }

  return sanitized;
}
