/**
 * OAuth Authentication Types
 *
 * Discord OAuth and authentication flow types.
 *
 * @module types/auth/oauth
 */

/**
 * Discord OAuth token response
 *
 * Response from Discord's OAuth token endpoint.
 * @see https://discord.com/developers/docs/topics/oauth2#authorization-code-grant-access-token-response
 */
export interface DiscordTokenResponse {
  /** OAuth access token */
  access_token: string;

  /** Token type (typically "Bearer") */
  token_type: string;

  /** Token expiration time in seconds */
  expires_in: number;

  /** Refresh token for obtaining new access tokens */
  refresh_token: string;

  /** Authorized scopes (space-separated) */
  scope: string;
}

/**
 * Discord user object
 *
 * User data returned from Discord's API.
 * @see https://discord.com/developers/docs/resources/user#user-object
 */
export interface DiscordUser {
  /** Discord user ID (18-digit snowflake) */
  id: string;

  /** Discord username */
  username: string;

  /** Discriminator (deprecated, now always "0") */
  discriminator: string;

  /** Avatar hash (null if no avatar) */
  avatar: string | null;

  /** Global display name (null if not set) */
  global_name: string | null;

  /** User's email (requires 'email' scope) */
  email?: string;

  /** Whether email is verified (requires 'email' scope) */
  verified?: boolean;

  /** User's banner hash */
  banner?: string | null;

  /** User's banner color */
  banner_color?: string | null;

  /** User's accent color */
  accent_color?: number | null;
}

/**
 * OAuth session state for desktop app authentication
 *
 * Temporary session data stored during OAuth flow.
 */
export interface OAuthSession {
  /** One-time password for session verification (required for desktop app flow) */
  otp?: string;

  /** JWT token to be retrieved after verification (required for desktop app flow) */
  jwt?: string;

  /** Session creation timestamp (Unix ms) */
  createdAt: number;

  /** Session expiration timestamp (Unix ms) */
  expiresAt: number;

  /** Session ID (for CSRF protection) */
  sessionId?: string;

  /** Redirect URI for OAuth flow */
  redirectUri?: string;

  /** Custom metadata for the session */
  metadata?: Record<string, unknown>;
}

/**
 * OAuth callback parameters (from Discord redirect)
 */
export interface OAuthCallbackParams {
  /** OAuth authorization code */
  code: string;

  /** State parameter for CSRF protection */
  state: string;

  /** Error code if authorization failed */
  error?: string;

  /** Error description if authorization failed */
  error_description?: string;
}
