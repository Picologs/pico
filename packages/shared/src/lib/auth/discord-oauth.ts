/**
 * Discord OAuth Utilities
 *
 * Platform-agnostic utilities for Discord OAuth 2.0 authentication flow.
 * Handles token exchange, user fetching, token refresh, and profile synchronization.
 *
 * @module auth/discord-oauth
 *
 * @example
 * ```typescript
 * import { createDiscordOAuthClient } from '@pico/shared';
 *
 * // Create configured client
 * const oauth = createDiscordOAuthClient({
 *   clientId: process.env.DISCORD_CLIENT_ID!,
 *   clientSecret: process.env.DISCORD_CLIENT_SECRET!,
 *   redirectUri: 'https://example.com/auth/callback'
 * });
 *
 * // Exchange authorization code for tokens
 * const tokens = await oauth.exchangeCode(code);
 *
 * // Fetch user profile
 * const user = await oauth.getUser(tokens.access_token);
 *
 * // Sync profile data
 * const profileUpdate = oauth.syncProfile(user);
 * ```
 */

import type { DiscordTokenResponse, DiscordUser } from "@pico/types";

// Re-export types for convenience
export type { DiscordTokenResponse, DiscordUser };

/**
 * Discord OAuth configuration
 */
export interface DiscordOAuthConfig {
  /** Discord application client ID */
  clientId: string;
  /** Discord application client secret */
  clientSecret: string;
  /** OAuth redirect URI (must match Discord app settings) */
  redirectUri: string;
  /** Discord API endpoint (default: https://discord.com/api/v10) */
  apiEndpoint?: string;
}

/**
 * Profile data for syncing with application database
 */
export interface ProfileSyncData {
  /** Discord user ID */
  discordId: string;
  /** Username */
  username: string;
  /** Avatar hash (null if no avatar) */
  avatar: string | null;
  /** Display name (username or global_name) */
  displayName: string;
  /** Email (if available) */
  email?: string;
}

/**
 * Discord OAuth error response from API
 */
export interface DiscordOAuthErrorResponse {
  /** Error code */
  error: string;
  /** Error description */
  error_description?: string;
}

/**
 * Discord OAuth client error
 */
export class DiscordOAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_CODE"
      | "EXPIRED_CODE"
      | "INVALID_GRANT"
      | "INVALID_TOKEN"
      | "NETWORK_ERROR"
      | "API_ERROR"
      | "INVALID_RESPONSE",
    public readonly status?: number,
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = "DiscordOAuthError";
  }
}

/**
 * Discord OAuth Client
 *
 * Provides methods for interacting with Discord OAuth 2.0 API.
 * Platform-agnostic and works in browser, Node.js, Bun, Deno, and Tauri.
 *
 * @example
 * ```typescript
 * const client = new DiscordOAuthClient({
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   redirectUri: 'https://example.com/callback'
 * });
 *
 * // Exchange code for tokens
 * const tokens = await client.exchangeCode(authCode);
 *
 * // Fetch user
 * const user = await client.getUser(tokens.access_token);
 *
 * // Refresh token
 * const newTokens = await client.refreshToken(tokens.refresh_token);
 * ```
 */
export class DiscordOAuthClient {
  private config: Required<DiscordOAuthConfig>;

  /**
   * Create a new Discord OAuth client
   *
   * @param config - OAuth configuration
   */
  constructor(config: DiscordOAuthConfig) {
    this.config = {
      ...config,
      apiEndpoint: config.apiEndpoint ?? "https://discord.com/api/v10",
    };
  }

  /**
   * Exchange authorization code for access token
   *
   * @param code - Authorization code from OAuth callback
   * @returns Token response with access token, refresh token, etc.
   * @throws {DiscordOAuthError} If token exchange fails
   *
   * @example
   * ```typescript
   * // On OAuth callback
   * const code = new URLSearchParams(window.location.search).get('code');
   * const tokens = await client.exchangeCode(code);
   * console.log('Access token:', tokens.access_token);
   * ```
   */
  async exchangeCode(code: string): Promise<DiscordTokenResponse> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Check for common error codes
        if (
          errorText.includes("invalid_grant") ||
          errorText.includes("code") ||
          response.status === 400
        ) {
          throw new DiscordOAuthError(
            "Authorization code is invalid or expired",
            "EXPIRED_CODE",
            response.status,
            errorText,
          );
        }

        throw new DiscordOAuthError(
          `Token exchange failed: ${errorText}`,
          "API_ERROR",
          response.status,
          errorText,
        );
      }

      const tokens: DiscordTokenResponse = await response.json();
      return tokens;
    } catch (error) {
      if (error instanceof DiscordOAuthError) {
        throw error;
      }

      throw new DiscordOAuthError(
        `Network error during token exchange: ${error instanceof Error ? error.message : "Unknown error"}`,
        "NETWORK_ERROR",
        undefined,
        error,
      );
    }
  }

  /**
   * Fetch Discord user profile
   *
   * @param accessToken - Discord OAuth access token
   * @returns Discord user object
   * @throws {DiscordOAuthError} If user fetch fails
   *
   * @example
   * ```typescript
   * const user = await client.getUser(tokens.access_token);
   * console.log('Username:', user.username);
   * console.log('Discord ID:', user.id);
   * ```
   */
  async getUser(accessToken: string): Promise<DiscordUser> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (response.status === 401) {
          throw new DiscordOAuthError(
            "Invalid or expired access token",
            "INVALID_TOKEN",
            response.status,
            errorText,
          );
        }

        throw new DiscordOAuthError(
          `Failed to fetch user: ${errorText}`,
          "API_ERROR",
          response.status,
          errorText,
        );
      }

      const user: DiscordUser = await response.json();
      return user;
    } catch (error) {
      if (error instanceof DiscordOAuthError) {
        throw error;
      }

      throw new DiscordOAuthError(
        `Network error during user fetch: ${error instanceof Error ? error.message : "Unknown error"}`,
        "NETWORK_ERROR",
        undefined,
        error,
      );
    }
  }

  /**
   * Refresh an expired access token
   *
   * @param refreshToken - Refresh token from previous token response
   * @returns New token response
   * @throws {DiscordOAuthError} If token refresh fails
   *
   * @example
   * ```typescript
   * // When access token expires
   * const newTokens = await client.refreshToken(oldTokens.refresh_token);
   * console.log('New access token:', newTokens.access_token);
   * ```
   */
  async refreshToken(refreshToken: string): Promise<DiscordTokenResponse> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        if (errorText.includes("invalid_grant") || response.status === 400) {
          throw new DiscordOAuthError(
            "Refresh token is invalid or expired",
            "INVALID_GRANT",
            response.status,
            errorText,
          );
        }

        throw new DiscordOAuthError(
          `Token refresh failed: ${errorText}`,
          "API_ERROR",
          response.status,
          errorText,
        );
      }

      const tokens: DiscordTokenResponse = await response.json();
      return tokens;
    } catch (error) {
      if (error instanceof DiscordOAuthError) {
        throw error;
      }

      throw new DiscordOAuthError(
        `Network error during token refresh: ${error instanceof Error ? error.message : "Unknown error"}`,
        "NETWORK_ERROR",
        undefined,
        error,
      );
    }
  }

  /**
   * Revoke an access token
   *
   * @param accessToken - Access token to revoke
   * @throws {DiscordOAuthError} If token revocation fails
   *
   * @example
   * ```typescript
   * // User logs out
   * await client.revokeToken(tokens.access_token);
   * ```
   */
  async revokeToken(accessToken: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.apiEndpoint}/oauth2/token/revoke`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            token: accessToken,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new DiscordOAuthError(
          `Token revocation failed: ${errorText}`,
          "API_ERROR",
          response.status,
          errorText,
        );
      }
    } catch (error) {
      if (error instanceof DiscordOAuthError) {
        throw error;
      }

      throw new DiscordOAuthError(
        `Network error during token revocation: ${error instanceof Error ? error.message : "Unknown error"}`,
        "NETWORK_ERROR",
        undefined,
        error,
      );
    }
  }

  /**
   * Synchronize Discord user data to application profile format
   *
   * Extracts relevant fields from Discord user object and normalizes
   * them for storage in application database.
   *
   * @param user - Discord user object
   * @returns Normalized profile data
   *
   * @example
   * ```typescript
   * const user = await client.getUser(tokens.access_token);
   * const profileData = client.syncProfile(user);
   *
   * // Save to database
   * await db.users.upsert({
   *   where: { discordId: profileData.discordId },
   *   update: profileData,
   *   create: { ...profileData, friendCode: generateFriendCode() }
   * });
   * ```
   */
  syncProfile(user: DiscordUser): ProfileSyncData {
    return {
      discordId: user.id,
      username: user.username,
      avatar: user.avatar,
      displayName: user.global_name || user.username,
      ...(user.email && { email: user.email }),
    };
  }

  /**
   * Generate Discord OAuth authorization URL
   *
   * @param options - Authorization options
   * @returns OAuth authorization URL
   *
   * @example
   * ```typescript
   * const authUrl = client.getAuthorizationUrl({
   *   state: sessionId,
   *   scopes: ['identify', 'email']
   * });
   *
   * // Redirect user to authorization URL
   * window.location.href = authUrl;
   * ```
   */
  getAuthorizationUrl(options: {
    /** OAuth state parameter (for CSRF protection) */
    state?: string;
    /** OAuth scopes to request (default: ['identify']) */
    scopes?: string[];
    /** Prompt type (default: 'consent') */
    prompt?: "none" | "consent";
  }): string {
    const scopes = options.scopes ?? ["identify"];
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      ...(options.state && { state: options.state }),
      ...(options.prompt && { prompt: options.prompt }),
    });

    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }
}

/**
 * Create a Discord OAuth client with configuration
 *
 * Factory function for creating a configured Discord OAuth client.
 *
 * @param config - OAuth configuration
 * @returns Configured Discord OAuth client
 *
 * @example
 * ```typescript
 * import { createDiscordOAuthClient } from '@pico/shared';
 *
 * const oauth = createDiscordOAuthClient({
 *   clientId: process.env.DISCORD_CLIENT_ID!,
 *   clientSecret: process.env.DISCORD_CLIENT_SECRET!,
 *   redirectUri: 'https://example.com/auth/callback'
 * });
 *
 * // Use in OAuth flow
 * const tokens = await oauth.exchangeCode(code);
 * const user = await oauth.getUser(tokens.access_token);
 * ```
 */
export function createDiscordOAuthClient(
  config: DiscordOAuthConfig,
): DiscordOAuthClient {
  return new DiscordOAuthClient(config);
}

/**
 * Helper: Exchange code and fetch user in one step
 *
 * Convenience function that combines token exchange and user fetch.
 *
 * @param code - Authorization code from OAuth callback
 * @param config - OAuth configuration
 * @returns Tuple of [tokens, user]
 *
 * @example
 * ```typescript
 * import { authenticateWithDiscord } from '@pico/shared';
 *
 * const [tokens, user] = await authenticateWithDiscord(code, {
 *   clientId: process.env.DISCORD_CLIENT_ID!,
 *   clientSecret: process.env.DISCORD_CLIENT_SECRET!,
 *   redirectUri: 'https://example.com/auth/callback'
 * });
 *
 * console.log('User:', user.username);
 * console.log('Access token:', tokens.access_token);
 * ```
 */
export async function authenticateWithDiscord(
  code: string,
  config: DiscordOAuthConfig,
): Promise<[DiscordTokenResponse, DiscordUser]> {
  const client = createDiscordOAuthClient(config);
  const tokens = await client.exchangeCode(code);
  const user = await client.getUser(tokens.access_token);
  return [tokens, user];
}

/**
 * Helper: Get Discord avatar URL
 *
 * Generates the full URL for a user's Discord avatar.
 *
 * @param userId - Discord user ID
 * @param avatarHash - Avatar hash (from user.avatar)
 * @param size - Image size (default: 128, must be power of 2)
 * @returns Avatar URL or null if no avatar
 *
 * @example
 * ```typescript
 * import { getDiscordAvatarUrl } from '@pico/shared';
 *
 * const user = await oauth.getUser(token);
 * const avatarUrl = getDiscordAvatarUrl(user.id, user.avatar, 256);
 *
 * if (avatarUrl) {
 *   console.log('Avatar URL:', avatarUrl);
 * } else {
 *   console.log('User has no avatar');
 * }
 * ```
 */
export function getDiscordAvatarUrl(
  userId: string,
  avatarHash: string | null,
  size: 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 = 128,
): string | null {
  if (!avatarHash) {
    return null;
  }

  // Determine format (animated avatars start with 'a_')
  const format = avatarHash.startsWith("a_") ? "gif" : "png";

  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${format}?size=${size}`;
}

/**
 * Helper: Get default Discord avatar URL
 *
 * Generates the URL for Discord's default avatar based on user discriminator.
 * For new usernames (discriminator "0"), uses modulo of user ID.
 *
 * @param userId - Discord user ID
 * @param discriminator - User discriminator (4-digit or "0" for new users)
 * @returns Default avatar URL
 *
 * @example
 * ```typescript
 * import { getDefaultDiscordAvatarUrl } from '@pico/shared';
 *
 * const user = await oauth.getUser(token);
 * const avatarUrl = user.avatar
 *   ? getDiscordAvatarUrl(user.id, user.avatar)
 *   : getDefaultDiscordAvatarUrl(user.id, user.discriminator);
 * ```
 */
export function getDefaultDiscordAvatarUrl(
  userId: string,
  discriminator: string,
): string {
  // New username system (discriminator is "0")
  if (discriminator === "0") {
    // Use BigInt for user ID calculation (Discord IDs are larger than Number.MAX_SAFE_INTEGER)
    const userIdBigInt = BigInt(userId);
    const shiftedId = userIdBigInt >> BigInt(22);
    const index = Number(shiftedId % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }

  // Legacy discriminator system
  const index = parseInt(discriminator, 10) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

/**
 * Helper: Validate Discord OAuth state parameter
 *
 * Validates state parameter from OAuth callback to prevent CSRF attacks.
 *
 * @param state - State from OAuth callback
 * @param expectedState - Expected state (from session)
 * @returns True if valid, false otherwise
 *
 * @example
 * ```typescript
 * import { validateDiscordState } from '@pico/shared';
 *
 * // Generate state before OAuth
 * const state = crypto.randomUUID();
 * sessionStorage.setItem('oauth_state', state);
 *
 * // Validate on callback
 * const callbackState = new URLSearchParams(window.location.search).get('state');
 * const storedState = sessionStorage.getItem('oauth_state');
 *
 * if (validateDiscordState(callbackState, storedState)) {
 *   // Continue with OAuth flow
 *   sessionStorage.removeItem('oauth_state');
 * } else {
 *   // Invalid state - possible CSRF attack
 *   console.error('Invalid OAuth state');
 * }
 * ```
 */
export function validateDiscordState(
  state: string | null,
  expectedState: string | null,
): boolean {
  if (!state || !expectedState) {
    return false;
  }

  return state === expectedState;
}
