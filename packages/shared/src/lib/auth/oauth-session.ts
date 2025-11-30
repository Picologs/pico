/**
 * OAuth Session Management Utilities
 *
 * Platform-agnostic utilities for managing OAuth authentication sessions.
 * Handles session ID generation, validation, and state management for OAuth flows.
 *
 * @module oauth-session
 * @example
 * ```typescript
 * import { OAuthSessionManager } from '@pico/shared';
 *
 * // Create session manager with storage adapter
 * const sessionManager = new OAuthSessionManager({
 *   load: async () => localStorage.getItem('oauth_session'),
 *   save: async (data) => localStorage.setItem('oauth_session', data),
 *   clear: async () => localStorage.removeItem('oauth_session')
 * });
 *
 * // Generate session for OAuth flow
 * const sessionId = await sessionManager.createSession({
 *   redirectUri: 'https://example.com/callback'
 * });
 *
 * // Validate session on callback
 * const session = await sessionManager.validateSession(sessionId);
 * if (session) {
 *   console.log('Valid session:', session);
 * }
 * ```
 */

import type { OAuthSession } from "@pico/types";

// Re-export type for convenience
export type { OAuthSession };

/**
 * Storage adapter interface for OAuth session data
 *
 * Allows the session manager to work with any storage mechanism
 * (localStorage, Tauri store, database, etc.)
 */
export interface OAuthSessionStorage {
  /** Load session data from storage */
  load: () => Promise<string | null>;
  /** Save session data to storage */
  save: (data: string) => Promise<void>;
  /** Clear session data from storage */
  clear: () => Promise<void>;
}

/**
 * OAuth session manager options
 */
export interface OAuthSessionManagerOptions {
  /** Session timeout in milliseconds (default: 10 minutes) */
  sessionTimeout?: number;
  /** Whether to use timestamp-based session IDs (default: true) */
  useTimestampedIds?: boolean;
}

/**
 * OAuth Session Manager
 *
 * Manages OAuth authentication sessions with secure session ID generation,
 * validation, and automatic expiration.
 *
 * Features:
 * - Cryptographically secure session IDs
 * - Automatic session expiration
 * - Platform-agnostic storage via adapter pattern
 * - Single-use session validation
 * - Timestamp-based session IDs for added security
 *
 * @example
 * ```typescript
 * // Browser with localStorage
 * const sessionManager = new OAuthSessionManager({
 *   load: async () => localStorage.getItem('oauth_session'),
 *   save: async (data) => localStorage.setItem('oauth_session', data),
 *   clear: async () => localStorage.removeItem('oauth_session')
 * });
 *
 * // Tauri with store plugin
 * import { load } from '@tauri-apps/plugin-store';
 * const store = await load('auth.json');
 * const sessionManager = new OAuthSessionManager({
 *   load: async () => await store.get('oauth_session'),
 *   save: async (data) => await store.set('oauth_session', data),
 *   clear: async () => await store.delete('oauth_session')
 * });
 * ```
 */
export class OAuthSessionManager {
  private storage: OAuthSessionStorage;
  private sessionTimeout: number;
  private useTimestampedIds: boolean;

  /**
   * Create a new OAuth session manager
   *
   * @param storage - Storage adapter for persisting session data
   * @param options - Configuration options
   */
  constructor(
    storage: OAuthSessionStorage,
    options: OAuthSessionManagerOptions = {},
  ) {
    this.storage = storage;
    this.sessionTimeout = options.sessionTimeout ?? 10 * 60 * 1000; // 10 minutes default
    this.useTimestampedIds = options.useTimestampedIds ?? true;
  }

  /**
   * Generate a secure session ID
   *
   * Creates a cryptographically secure random session identifier.
   * Optionally includes timestamp for single-use validation.
   *
   * @returns Session ID string
   * @private
   */
  private generateSessionId(): string {
    const uuid = crypto.randomUUID();

    if (this.useTimestampedIds) {
      // Format: {uuid}:{timestamp}
      // Timestamp allows for single-use validation and prevents replay attacks
      return `${uuid}:${Date.now()}`;
    }

    return uuid;
  }

  /**
   * Parse timestamped session ID
   *
   * Extracts UUID and timestamp from session ID if using timestamped IDs.
   *
   * @param sessionId - Session ID string
   * @returns Parsed components or null if invalid format
   * @private
   */
  private parseSessionId(
    sessionId: string,
  ): { uuid: string; timestamp: number } | null {
    if (!this.useTimestampedIds) {
      return { uuid: sessionId, timestamp: Date.now() };
    }

    const parts = sessionId.split(":");
    if (parts.length !== 2) {
      return null;
    }

    const [uuid, timestampStr] = parts;
    const timestamp = parseInt(timestampStr, 10);

    if (isNaN(timestamp)) {
      return null;
    }

    return { uuid, timestamp };
  }

  /**
   * Create a new OAuth session
   *
   * Generates a secure session ID, stores session data, and returns the session ID
   * for use in the OAuth authorization URL.
   *
   * @param data - Session metadata (redirect URI, custom data, etc.)
   * @returns Session ID string
   *
   * @example
   * ```typescript
   * const sessionId = await sessionManager.createSession({
   *   redirectUri: 'https://example.com/callback',
   *   metadata: { userId: '123', flow: 'login' }
   * });
   *
   * // Use session ID in OAuth URL
   * const authUrl = `https://provider.com/oauth/authorize?state=${sessionId}`;
   * ```
   */
  async createSession(data: {
    redirectUri?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: OAuthSession = {
      sessionId,
      createdAt: now,
      expiresAt: now + this.sessionTimeout,
      redirectUri: data.redirectUri,
      metadata: data.metadata,
    };

    await this.storage.save(JSON.stringify(session));
    return sessionId;
  }

  /**
   * Validate OAuth session
   *
   * Checks if a session ID is valid and not expired.
   * This is a single-use validation - the session is cleared after validation.
   *
   * @param sessionId - Session ID to validate
   * @returns Session data if valid, null otherwise
   *
   * @example
   * ```typescript
   * // On OAuth callback
   * const sessionId = new URLSearchParams(window.location.search).get('state');
   * const session = await sessionManager.validateSession(sessionId);
   *
   * if (session) {
   *   console.log('Valid session:', session);
   *   // Continue with OAuth flow
   * } else {
   *   console.error('Invalid or expired session');
   *   // Show error to user
   * }
   * ```
   */
  async validateSession(
    sessionId: string | null,
  ): Promise<OAuthSession | null> {
    if (!sessionId) {
      return null;
    }

    // Parse session ID
    const parsed = this.parseSessionId(sessionId);
    if (!parsed) {
      return null;
    }

    // Load stored session
    const storedData = await this.storage.load();
    if (!storedData) {
      return null;
    }

    let storedSession: OAuthSession;
    try {
      storedSession = JSON.parse(storedData) as OAuthSession;
    } catch {
      await this.storage.clear();
      return null;
    }

    // Validate session ID matches
    if (storedSession.sessionId !== sessionId) {
      return null;
    }

    // Check expiration
    if (Date.now() > storedSession.expiresAt) {
      await this.storage.clear();
      return null;
    }

    // Single-use: clear session after validation
    await this.storage.clear();

    return storedSession;
  }

  /**
   * Clear current session
   *
   * Removes session data from storage. Useful for cleanup or canceling an OAuth flow.
   *
   * @example
   * ```typescript
   * // User canceled OAuth flow
   * await sessionManager.clearSession();
   * ```
   */
  async clearSession(): Promise<void> {
    await this.storage.clear();
  }

  /**
   * Get current session without validation
   *
   * Retrieves the current session data without clearing it.
   * Useful for checking session state without consuming it.
   *
   * @returns Session data or null if no session exists
   *
   * @example
   * ```typescript
   * const session = await sessionManager.getCurrentSession();
   * if (session) {
   *   console.log('Session expires at:', new Date(session.expiresAt));
   * }
   * ```
   */
  async getCurrentSession(): Promise<OAuthSession | null> {
    const storedData = await this.storage.load();
    if (!storedData) {
      return null;
    }

    try {
      const session = JSON.parse(storedData) as OAuthSession;

      // Check expiration
      if (Date.now() > session.expiresAt) {
        await this.storage.clear();
        return null;
      }

      return session;
    } catch {
      await this.storage.clear();
      return null;
    }
  }
}

/**
 * Generate a simple OAuth state parameter
 *
 * Utility function for generating a cryptographically secure OAuth state parameter.
 * Use this for simple OAuth flows that don't need full session management.
 *
 * @param useTimestamp - Whether to include timestamp for replay attack prevention (default: true)
 * @returns OAuth state string
 *
 * @example
 * ```typescript
 * import { generateOAuthState } from '@pico/shared';
 *
 * // Generate state for OAuth URL
 * const state = generateOAuthState();
 * const authUrl = `https://provider.com/oauth/authorize?state=${state}`;
 *
 * // Store state for validation
 * localStorage.setItem('oauth_state', state);
 *
 * // Later, validate on callback
 * const callbackState = new URLSearchParams(window.location.search).get('state');
 * if (callbackState === localStorage.getItem('oauth_state')) {
 *   console.log('Valid state');
 * }
 * ```
 */
export function generateOAuthState(useTimestamp: boolean = true): string {
  const uuid = crypto.randomUUID();
  if (useTimestamp) {
    return `${uuid}:${Date.now()}`;
  }
  return uuid;
}

/**
 * Validate OAuth state parameter
 *
 * Simple validation for OAuth state parameters.
 * Checks format and timestamp if applicable.
 *
 * @param state - State parameter from OAuth callback
 * @param expectedState - Expected state value (from storage)
 * @param maxAgeMs - Maximum age in milliseconds (default: 10 minutes)
 * @returns True if state is valid, false otherwise
 *
 * @example
 * ```typescript
 * import { validateOAuthState } from '@pico/shared';
 *
 * // On OAuth callback
 * const callbackState = new URLSearchParams(window.location.search).get('state');
 * const storedState = localStorage.getItem('oauth_state');
 *
 * if (validateOAuthState(callbackState, storedState, 10 * 60 * 1000)) {
 *   console.log('Valid state');
 *   localStorage.removeItem('oauth_state'); // Single-use
 * } else {
 *   console.error('Invalid or expired state');
 * }
 * ```
 */
export function validateOAuthState(
  state: string | null,
  expectedState: string | null,
  maxAgeMs: number = 10 * 60 * 1000,
): boolean {
  if (!state || !expectedState || state !== expectedState) {
    return false;
  }

  // Check timestamp if present
  const parts = state.split(":");
  if (parts.length === 2) {
    const timestamp = parseInt(parts[1], 10);
    if (!isNaN(timestamp)) {
      const age = Date.now() - timestamp;
      if (age > maxAgeMs) {
        return false; // Expired
      }
    }
  }

  return true;
}
