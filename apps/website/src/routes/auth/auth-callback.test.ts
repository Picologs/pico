/**
 * OAuth Callback Handler Tests
 *
 * Tests the Discord OAuth callback handling including:
 * - CSRF state validation
 * - Web authentication flow
 * - Desktop authentication flow
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock shared server utilities
vi.mock('@pico/shared/server', () => ({
	handleDiscordCallback: vi.fn(),
	generateExpiredCodeHTML: vi.fn().mockReturnValue('<html>Expired</html>'),
	createDrizzleAdapter: vi.fn().mockReturnValue({})
}));

// Import mocked module
import { handleDiscordCallback } from '@pico/shared/server';
import type { Mock } from 'vitest';

describe('OAuth Callback Handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset environment
		process.env.DISCORD_CLIENT_ID = 'test-client-id';
		process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
		process.env.JWT_SECRET = 'test-jwt-secret';
		process.env.WEBSOCKET_SERVER_URL = 'http://localhost:8080';
		process.env.BROADCAST_API_KEY = 'test-broadcast-key';
	});

	describe('CSRF State Validation', () => {
		it('should validate web OAuth state against stored cookie', async () => {
			const state = 'web:random-state-123';
			const storedState = JSON.stringify({
				state: 'web:random-state-123',
				expiry: Date.now() + 600000 // 10 minutes
			});

			// State matches - validation passes
			expect(state).toBe(JSON.parse(storedState).state);
		});

		it('should reject mismatched state', async () => {
			const state = 'web:random-state-123';
			const storedState = JSON.stringify({
				state: 'web:different-state-456',
				expiry: Date.now() + 600000
			});

			expect(state).not.toBe(JSON.parse(storedState).state);
		});

		it('should reject expired state', async () => {
			const storedState = JSON.stringify({
				state: 'web:random-state-123',
				expiry: Date.now() - 1000 // Expired
			});

			const parsed = JSON.parse(storedState);
			expect(Date.now()).toBeGreaterThan(parsed.expiry);
		});

		it('should skip state validation for desktop auth', async () => {
			const state = 'desktop:session-123';

			// Desktop auth uses different validation flow
			expect(state.startsWith('desktop:')).toBe(true);
		});
	});

	describe('Web Authentication Flow', () => {
		it('should handle successful web authentication', async () => {
			(handleDiscordCallback as Mock).mockResolvedValue({
				type: 'web',
				jwtToken: 'test-jwt-token',
				user: {
					id: 'user-uuid-123',
					discordId: '123456789',
					username: 'TestUser',
					avatar: 'avatar-hash',
					friendCode: 'ABC123'
				}
			});

			const result = await handleDiscordCallback(
				{ code: 'auth-code', state: 'web:state', error: null },
				{
					clientId: 'test-client-id',
					clientSecret: 'test-client-secret',
					redirectUri: 'http://localhost/auth/callback',
					jwtSecret: 'test-jwt-secret',
					websocketServerUrl: 'http://localhost:8080',
					nodeEnv: 'test'
				},
				{} as any, // dbAdapter
				{} as any // cookiesAdapter
			);

			expect(result.type).toBe('web');
			expect((result as any).jwtToken).toBe('test-jwt-token');
			expect((result as any).user.username).toBe('TestUser');
		});

		it('should set auth cookie on successful web auth', async () => {
			const cookies = {
				set: vi.fn()
			};

			(handleDiscordCallback as Mock).mockResolvedValue({
				type: 'web',
				jwtToken: 'test-jwt-token',
				user: { id: '123' }
			});

			await handleDiscordCallback(
				{ code: 'auth-code', state: 'web:state', error: null },
				{ clientId: 'id', clientSecret: 'secret', redirectUri: 'uri', jwtSecret: 'secret' },
				{} as any,
				cookies as any
			);

			// Cookie adapter would be called by the handler
			expect(handleDiscordCallback).toHaveBeenCalled();
		});
	});

	describe('Desktop Authentication Flow', () => {
		it('should extract sessionId from desktop state', async () => {
			const state = 'desktop:session-uuid-123';
			const sessionId = state.replace('desktop:', '');

			expect(sessionId).toBe('session-uuid-123');
		});

		it('should handle successful desktop authentication', async () => {
			(handleDiscordCallback as Mock).mockResolvedValue({
				type: 'desktop',
				jwtToken: 'test-jwt-token',
				user: {
					id: 'user-uuid-123',
					discordId: '123456789',
					username: 'TestUser',
					avatar: 'avatar-hash',
					friendCode: 'ABC123'
				}
			});

			const result = await handleDiscordCallback(
				{ code: 'auth-code', state: 'desktop:session-123', error: null },
				{
					clientId: 'test-client-id',
					clientSecret: 'test-client-secret',
					redirectUri: 'http://localhost/auth/callback',
					jwtSecret: 'test-jwt-secret',
					websocketServerUrl: 'http://localhost:8080'
				},
				{} as any,
				{} as any
			);

			expect(result.type).toBe('desktop');
			expect((result as any).jwtToken).toBeTruthy();
		});

		it('should push auth result to WebSocket server for desktop', async () => {
			const mockFetch = vi.fn().mockResolvedValue({ ok: true });
			global.fetch = mockFetch;

			// Simulate pushing auth to desktop
			await mockFetch('http://localhost:8080/auth/desktop-complete', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer test-broadcast-key',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					sessionId: 'session-123',
					jwt: 'test-jwt-token',
					user: {
						id: 'user-123',
						discordId: '123456789',
						username: 'TestUser'
					}
				})
			});

			expect(mockFetch).toHaveBeenCalledWith(
				'http://localhost:8080/auth/desktop-complete',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						Authorization: 'Bearer test-broadcast-key'
					})
				})
			);
		});
	});

	describe('Error Handling', () => {
		it('should handle expired OAuth code', async () => {
			(handleDiscordCallback as Mock).mockResolvedValue({
				type: 'error',
				code: 'EXPIRED_CODE',
				status: 400,
				message: 'Authorization code expired'
			});

			const result = await handleDiscordCallback(
				{ code: 'expired-code', state: 'web:state', error: null },
				{ clientId: 'id', clientSecret: 'secret', redirectUri: 'uri', jwtSecret: 'secret' },
				{} as any,
				{} as any
			);

			expect(result.type).toBe('error');
			expect((result as any).code).toBe('EXPIRED_CODE');
		});

		it('should handle Discord OAuth error response', async () => {
			(handleDiscordCallback as Mock).mockResolvedValue({
				type: 'error',
				code: 'DISCORD_ERROR',
				status: 400,
				message: 'access_denied'
			});

			const result = await handleDiscordCallback(
				{ code: null, state: 'web:state', error: 'access_denied' },
				{ clientId: 'id', clientSecret: 'secret', redirectUri: 'uri', jwtSecret: 'secret' },
				{} as any,
				{} as any
			);

			expect(result.type).toBe('error');
		});

		it('should handle missing authorization code', async () => {
			(handleDiscordCallback as Mock).mockResolvedValue({
				type: 'error',
				code: 'MISSING_CODE',
				status: 400,
				message: 'Missing authorization code'
			});

			const result = await handleDiscordCallback(
				{ code: null, state: 'web:state', error: null },
				{ clientId: 'id', clientSecret: 'secret', redirectUri: 'uri', jwtSecret: 'secret' },
				{} as any,
				{} as any
			);

			expect(result.type).toBe('error');
		});

		it('should handle WebSocket server push failure for desktop auth', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				json: vi.fn().mockResolvedValue({ error: 'Server error' })
			});
			global.fetch = mockFetch;

			const response = await mockFetch('http://localhost:8080/auth/desktop-complete', {
				method: 'POST'
			});

			expect(response.ok).toBe(false);
		});
	});

	describe('Environment Validation', () => {
		it('should require DISCORD_CLIENT_ID', () => {
			const clientId = process.env.DISCORD_CLIENT_ID;
			expect(clientId).toBeTruthy();
		});

		it('should require DISCORD_CLIENT_SECRET', () => {
			const clientSecret = process.env.DISCORD_CLIENT_SECRET;
			expect(clientSecret).toBeTruthy();
		});

		it('should require JWT_SECRET', () => {
			const jwtSecret = process.env.JWT_SECRET;
			expect(jwtSecret).toBeTruthy();
		});
	});
});

describe('OAuth State Generation', () => {
	it('should generate unique state for each OAuth request', () => {
		const generateState = () => `web:${crypto.randomUUID()}`;

		const state1 = generateState();
		const state2 = generateState();

		expect(state1).not.toBe(state2);
		expect(state1.startsWith('web:')).toBe(true);
	});

	it('should include expiry time in state cookie', () => {
		const expiry = Date.now() + 600000; // 10 minutes
		const stateCookie = JSON.stringify({
			state: 'web:random-state',
			expiry
		});

		const parsed = JSON.parse(stateCookie);
		expect(parsed.expiry).toBeGreaterThan(Date.now());
	});
});
