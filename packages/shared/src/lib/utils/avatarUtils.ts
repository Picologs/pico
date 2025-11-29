/**
 * Avatar utility functions
 */

/**
 * Check if a string contains an emoji
 * Detects emojis using Unicode ranges for emoji characters
 * @param str String to check
 * @returns True if string contains emoji characters
 */
export function isEmoji(str: string | null | undefined): boolean {
  if (!str || typeof str !== "string") return false;

  // Trim whitespace
  const trimmed = str.trim();
  if (!trimmed) return false;

  // Exclude Discord avatar hashes (alphanumeric-only strings 3+ characters)
  // Discord hashes are typically 32+ chars of [a-zA-Z0-9_]
  // This prevents hashes like "a_1234567890abcdef" from being detected as emojis
  if (/^[a-zA-Z0-9_]{3,}$/.test(trimmed)) return false;

  // Emoji Unicode ranges:
  // - Basic emoticons: 0x1F600-0x1F64F
  // - Symbols & Pictographs: 0x1F300-0x1F5FF
  // - Transport & Map: 0x1F680-0x1F6FF
  // - Supplemental Symbols: 0x1F900-0x1F9FF
  // - Extended Pictographs: 0x1FA70-0x1FAFF
  // - Miscellaneous: 0x2600-0x26FF, 0x2700-0x27BF
  // Also includes variation selectors, zero-width joiners, and skin tone modifiers
  const emojiRegex = /[\p{Emoji_Presentation}\p{Emoji}\u200D\uFE0F]/u;

  return emojiRegex.test(trimmed) && !trimmed.startsWith("http");
}

/**
 * Check if avatar is a valid Discord avatar hash (not just a default avatar index)
 */
export function isValidAvatarHash(avatar: string | null | undefined): boolean {
  if (!avatar) return false;
  // Discord avatar hashes are alphanumeric strings (usually 32 chars)
  // Default avatars are just single digits (0-5), which are not valid custom avatars
  const cleanAvatar = avatar.replace(/\.(png|jpg|jpeg|gif|webp)$/i, "");
  return cleanAvatar.length > 2 && /^[a-zA-Z0-9_]+$/.test(cleanAvatar);
}

/**
 * Get Discord CDN avatar URL with domain allowlist support
 * @param discordId Discord user ID
 * @param avatar Avatar hash or full URL
 * @param size Avatar size in pixels (default: 128)
 * @param discordCdnUrl Discord CDN base URL (default: https://cdn.discordapp.com)
 * @param allowedDomains Additional allowed domains for full URLs (default: fly.storage.tigris.dev)
 * @returns Avatar URL or null if invalid
 */
export function getAvatarUrl(
  discordId: string | null | undefined,
  avatar: string | null | undefined,
  size: number = 128,
  discordCdnUrl: string = "https://cdn.discordapp.com",
  allowedDomains: string[] = ["fly.storage.tigris.dev"],
): string | null {
  if (!avatar) return null;

  // If avatar is already a full URL, validate it's from an allowed domain
  // Full URLs don't require discordId
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    try {
      const url = new URL(avatar);
      // Default allowed domains: Discord CDN + custom domains
      const defaultDomains = ["cdn.discordapp.com"];
      const allAllowedDomains = [...defaultDomains, ...allowedDomains];

      // Check if hostname matches or is a subdomain of allowed domains
      const isAllowed = allAllowedDomains.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith("." + domain),
      );

      if (isAllowed) {
        return avatar;
      }
      // Invalid domain, fall back to Discord avatar hash check
    } catch {
      // Invalid URL, fall back to Discord avatar hash check
    }
  }

  // For Discord avatar hashes, we need both avatar and discordId
  if (!discordId) return null;

  // Check if it's a valid Discord avatar hash
  if (!isValidAvatarHash(avatar)) return null;

  // Strip any existing extension to avoid duplication (.png.png)
  const avatarHash = avatar.replace(/\.(png|jpg|jpeg|gif|webp)$/i, "");

  // Discord CDN only accepts power-of-2 sizes: 16, 32, 64, 128, 256, 512, 1024, 2048, 4096
  // Round to nearest valid size
  const validSizes = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const validSize = validSizes.reduce((prev, curr) =>
    Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev,
  );

  return `${discordCdnUrl}/avatars/${discordId}/${avatarHash}.png?size=${validSize}`;
}
