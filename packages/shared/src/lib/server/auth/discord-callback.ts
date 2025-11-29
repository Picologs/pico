/**
 * Server-side Discord OAuth callback handler
 *
 * Reusable authentication logic for handling Discord OAuth callbacks.
 * Supports both web and desktop authentication flows.
 *
 * @module server/auth/discord-callback
 */

import {
  createDiscordOAuthClient,
  DiscordOAuthError,
} from "../../auth/discord-oauth.js";
import type {
  DiscordTokenResponse,
  DiscordUser,
} from "../../auth/discord-oauth.js";
import { generateJWT } from "../../auth/jwt.js";

/**
 * Configuration for Discord OAuth callback handler
 */
export interface DiscordCallbackConfig {
  /** Discord OAuth client ID */
  clientId: string;
  /** Discord OAuth client secret */
  clientSecret: string;
  /** OAuth redirect URI */
  redirectUri: string;
  /** JWT secret for signing WebSocket tokens */
  jwtSecret: string;
  /** WebSocket server URL (for desktop auth) */
  websocketServerUrl?: string;
  /** API key for WebSocket broadcast endpoint (for desktop auth) */
  broadcastApiKey?: string;
  /** Node environment (production/development) */
  nodeEnv?: string;
  /** Cookie domain (e.g., 'picologs.com' for production) */
  cookieDomain?: string;
}

/**
 * Database user type (minimal required fields)
 */
export interface DatabaseUser {
  id: number | string;
  discordId: string;
  username: string;
  avatar: string | null;
  friendCode: string | null;
  player?: string | null;
  blockedAt?: Date | null;
}

/**
 * Database adapter for user operations
 */
export interface DatabaseAdapter {
  /**
   * Find user by Discord ID
   */
  findUserByDiscordId(discordId: string): Promise<DatabaseUser | null>;

  /**
   * Create new user
   */
  createUser(data: {
    discordId: string;
    username: string;
    avatar: string | null;
    friendCode: string;
  }): Promise<DatabaseUser>;

  /**
   * Update user
   */
  updateUser(
    userId: number | string,
    data: { friendCode?: string },
  ): Promise<DatabaseUser>;

  /**
   * Generate unique friend code
   */
  generateUniqueFriendCode(): Promise<string>;

  /**
   * Check if new user signups are enabled
   * Returns true if signups are enabled, false if disabled
   */
  isSignupsEnabled?(): Promise<boolean>;
}

/**
 * Cookies adapter for setting cookies
 */
export interface CookiesAdapter {
  /**
   * Set a cookie
   */
  set(
    name: string,
    value: string,
    options: {
      path: string;
      domain?: string;
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax" | "strict" | "none";
      maxAge: number;
    },
  ): void;
}

/**
 * Result of successful authentication
 */
export interface AuthSuccessResult {
  type: "web" | "desktop";
  user: DatabaseUser;
  tokens?: DiscordTokenResponse;
  otp?: string;
  jwtToken?: string;
}

/**
 * Result of failed authentication
 */
export interface AuthErrorResult {
  type: "error";
  code: "EXPIRED_CODE" | "DATABASE_ERROR" | "DISCORD_ERROR" | "UNKNOWN_ERROR" | "SIGNUPS_DISABLED" | "USER_BLOCKED";
  message: string;
  status: number;
}

/**
 * Handle Discord OAuth callback
 *
 * @param params - Callback parameters
 * @param config - OAuth configuration
 * @param db - Database adapter
 * @param cookies - Cookies adapter (for web auth)
 * @returns Authentication result
 */
export async function handleDiscordCallback(
  params: {
    code: string | null;
    state: string | null;
    error: string | null;
  },
  config: DiscordCallbackConfig,
  db: DatabaseAdapter,
  cookies?: CookiesAdapter,
): Promise<AuthSuccessResult | AuthErrorResult> {
  // Check for OAuth error
  if (params.error) {
    console.error("[Auth Callback] Discord OAuth error:", params.error);
    return {
      type: "error",
      code: "DISCORD_ERROR",
      message: `Discord OAuth error: ${params.error}`,
      status: 400,
    };
  }

  // Validate authorization code
  if (!params.code) {
    console.error("[Auth Callback] No authorization code provided");
    return {
      type: "error",
      code: "DISCORD_ERROR",
      message: "No authorization code provided",
      status: 400,
    };
  }

  try {
    // Create Discord OAuth client
    const oauth = createDiscordOAuthClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    // Exchange code for tokens
    let tokens: DiscordTokenResponse;
    let user: DiscordUser;

    try {
      tokens = await oauth.exchangeCode(params.code);
      user = await oauth.getUser(tokens.access_token);
    } catch (error) {
      if (error instanceof DiscordOAuthError && error.code === "EXPIRED_CODE") {
        return {
          type: "error",
          code: "EXPIRED_CODE",
          message: "Authorization code is invalid or expired",
          status: 400,
        };
      }
      throw error;
    }

    // Create or update user in database
    let dbUser = await db.findUserByDiscordId(user.id);

    // Check if existing user is blocked
    if (dbUser?.blockedAt) {
      console.warn("[Auth Callback] Blocked user attempted login:", {
        discordId: user.id,
        username: user.username,
        blockedAt: dbUser.blockedAt,
      });
      return {
        type: "error",
        code: "USER_BLOCKED",
        message: "Your account has been suspended. Contact support for assistance.",
        status: 403,
      };
    }

    if (!dbUser) {
      // Check if signups are enabled before creating new user
      if (db.isSignupsEnabled) {
        const signupsEnabled = await db.isSignupsEnabled();
        if (!signupsEnabled) {
          console.info("[Auth Callback] New signup blocked - signups disabled:", {
            discordId: user.id,
            username: user.username,
          });
          return {
            type: "error",
            code: "SIGNUPS_DISABLED",
            message: "New registrations are currently disabled. Please try again later.",
            status: 403,
          };
        }
      }

      // Create new user
      const friendCode = await db.generateUniqueFriendCode();
      dbUser = await db.createUser({
        discordId: user.id,
        username: user.username,
        avatar: user.avatar,
        friendCode,
      });
    } else {
      // Update existing user with latest Discord info (avatar/username may have changed)
      const updateData: {
        username: string;
        avatar: string | null;
        friendCode?: string;
      } = {
        username: user.username,
        avatar: user.avatar,
      };

      // Generate friend code if missing (for legacy users)
      if (!dbUser.friendCode) {
        updateData.friendCode = await db.generateUniqueFriendCode();
      }

      dbUser = await db.updateUser(dbUser.id, updateData);
    }

    // Desktop app authentication (state starts with 'desktop:' prefix)
    if (params.state?.startsWith("desktop:")) {
      // Generate JWT token for WebSocket authentication
      const jwtToken = await generateJWT(
        {
          userId: dbUser.discordId,
          type: "websocket",
        },
        config.jwtSecret,
        "30d",
        {
          issuer: "picologs-website",
          audience: "picologs-websocket",
        },
      );

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      return {
        type: "desktop",
        user: dbUser,
        otp,
        jwtToken,
      };
    }

    // Web authentication
    if (!cookies) {
      throw new Error("Cookies adapter required for web authentication");
    }

    // Set cookies for website authentication
    cookies.set("discord_token", JSON.stringify(tokens.access_token), {
      path: "/",
      domain: config.cookieDomain,
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in,
    });

    cookies.set(
      "discord_info",
      JSON.stringify({
        id: dbUser.id,
        discordId: dbUser.discordId,
        username: dbUser.username,
        avatar: dbUser.avatar,
        player: dbUser.player,
        friendCode: dbUser.friendCode,
      }),
      {
        path: "/",
        domain: config.cookieDomain,
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "lax",
        maxAge: tokens.expires_in,
      },
    );

    return {
      type: "web",
      user: dbUser,
      tokens,
    };
  } catch (error) {
    console.error("[Auth Callback] OAuth flow failed:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      hasState: !!params.state,
      timestamp: new Date().toISOString(),
    });

    // Database errors
    if (error instanceof Error && error.message.includes("DATABASE")) {
      return {
        type: "error",
        code: "DATABASE_ERROR",
        message: "Database configuration error - please contact support",
        status: 500,
      };
    }

    // Discord errors
    if (error instanceof Error && error.message.includes("Discord")) {
      return {
        type: "error",
        code: "DISCORD_ERROR",
        message: `Discord authentication error: ${error.message}`,
        status: 500,
      };
    }

    // Unknown errors
    return {
      type: "error",
      code: "UNKNOWN_ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Authentication failed due to an unexpected error",
      status: 500,
    };
  }
}

/**
 * Generate HTML response for expired/invalid OAuth code
 */
export function generateExpiredCodeHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Link Expired - Picologs</title>
	<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen w-full flex flex-col items-center justify-center text-center" style="background: rgb(10, 30, 42);">
	<div class="mb-8">
		<img src="/pico.webp" alt="Picologs" class="w-32 h-32 object-contain mx-auto" />
	</div>
	<h1 class="text-4xl font-medium mb-6 text-white">Link Expired</h1>
	<p class="text-lg text-white/70 mb-8">This authentication link has expired or has already been used.</p>
	<p class="text-base text-white/60 mb-8">Please close this window and try logging in again.</p>
	<a href="/" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
		Return to Home
	</a>
</body>
</html>
	`.trim();
}

/**
 * Generate HTML response when signups are disabled
 */
export function generateSignupsDisabledHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Registrations Closed - Picologs</title>
	<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen w-full flex flex-col items-center justify-center text-center" style="background: rgb(10, 30, 42);">
	<div class="mb-8">
		<img src="/pico.webp" alt="Picologs" class="w-32 h-32 object-contain mx-auto" />
	</div>
	<h1 class="text-4xl font-medium mb-6 text-white">Registrations Temporarily Closed</h1>
	<p class="text-lg text-white/70 mb-8">We're experiencing high demand and have temporarily paused new signups.</p>
	<p class="text-base text-white/60 mb-8">Please check back later or follow us for updates on when registrations reopen.</p>
	<a href="/" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
		Return to Home
	</a>
</body>
</html>
	`.trim();
}

/**
 * Generate HTML response when user is blocked
 */
export function generateUserBlockedHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Account Suspended - Picologs</title>
	<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen w-full flex flex-col items-center justify-center text-center" style="background: rgb(10, 30, 42);">
	<div class="mb-8">
		<img src="/pico.webp" alt="Picologs" class="w-32 h-32 object-contain mx-auto" />
	</div>
	<h1 class="text-4xl font-medium mb-6 text-white">Account Suspended</h1>
	<p class="text-lg text-white/70 mb-8">Your account has been suspended due to a violation of our terms of service.</p>
	<p class="text-base text-white/60 mb-8">If you believe this is an error, please contact support.</p>
	<a href="/" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
		Return to Home
	</a>
</body>
</html>
	`.trim();
}

/**
 * Generate HTML response for successful desktop authentication
 */
export function generateDesktopAuthSuccessHTML(
  otp: string,
  jwtToken: string,
  sessionId: string,
  websocketServerUrl: string,
): string {
  const wsUrl = websocketServerUrl.replace(/^http/, "ws") + "/ws";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Enter Code - Picologs</title>
	<script src="https://cdn.tailwindcss.com"></script>
	<script>
		// Connect to WebSocket and store OTP
		const wsUrl = '${wsUrl}';
		const ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			// Send store_auth_otp message
			ws.send(JSON.stringify({
				type: 'store_auth_otp',
				data: {
					sessionId: '${sessionId}',
					otp: '${otp}',
					jwt: '${jwtToken}'
				}
			}));
		};

		ws.onmessage = (event) => {
			const msg = JSON.parse(event.data);
			if (msg.type === 'response' && msg.data?.success) {
				ws.close();
			}
		};

		ws.onerror = (error) => {
			console.error('WebSocket error:', error);
		};
	</script>
</head>
<body class="min-h-screen w-full flex flex-col items-center justify-center text-center" style="background: rgb(10, 30, 42);">
	<div class="mb-8">
		<img src="/pico.webp" alt="Picologs" class="w-32 h-32 object-contain mx-auto" />
	</div>
	<h1 class="text-4xl font-medium mb-6 text-white">Authentication Successful!</h1>
	<p class="text-lg text-white/70 mb-8">Enter this code in the Picologs app:</p>
	<div class="flex gap-3 justify-center mb-4" ondblclick="window.getSelection().selectAllChildren(this.querySelector('.otp-container'))">
		<div class="otp-container flex gap-3" style="user-select: all; -webkit-user-select: all;">
			${otp
        .split("")
        .map(
          (digit) => `
			<div class="w-16 h-20 flex items-center justify-center bg-blue-600 text-white rounded-lg">
				<span class="text-5xl font-bold">${digit}</span>
			</div>
		`,
        )
        .join("")}
		</div>
	</div>
	<button onclick="navigator.clipboard.writeText('${otp}').then(() => { const btn = this; btn.innerHTML = '<svg class=&quot;w-5 h-5 inline mr-2&quot; fill=&quot;currentColor&quot; viewBox=&quot;0 0 20 20&quot;><path d=&quot;M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z&quot;/></svg>Copied!'; setTimeout(() => btn.innerHTML = '<svg class=&quot;w-5 h-5 inline mr-2&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;><path stroke-linecap=&quot;round&quot; stroke-linejoin=&quot;round&quot; stroke-width=&quot;2&quot; d=&quot;M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z&quot;/></svg>Copy Code', 1500); })" class="mb-6 px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white transition-colors flex items-center mx-auto">
		<svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
		</svg>
		Copy Code
	</button>
	<p class="text-sm text-white/50">This code will expire in 5 minutes</p>
</body>
</html>
	`.trim();
}
