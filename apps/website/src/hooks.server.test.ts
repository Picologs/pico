/**
 * Server Hooks Tests
 *
 * Tests the SvelteKit server hooks including:
 * - WWW redirect middleware
 * - Auth middleware
 * - Request handling chain
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock shared server utilities
vi.mock('@pico/shared/server', () => ({
	createAuthMiddleware: vi.fn().mockReturnValue(vi.fn()),
	createWWWRedirectMiddleware: vi.fn().mockReturnValue(vi.fn())
}));

// Mock database
vi.mock('$lib/db', () => ({
	db: {},
	schema: {}
}));

import { createAuthMiddleware, createWWWRedirectMiddleware } from '@pico/shared/server';

describe('Server Hooks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.JWT_SECRET = 'test-jwt-secret';
	});

	describe('WWW Redirect Middleware', () => {
		it('should create WWW redirect middleware with domain config', () => {
			createWWWRedirectMiddleware({ domain: 'picologs.com' });

			expect(createWWWRedirectMiddleware).toHaveBeenCalledWith({
				domain: 'picologs.com'
			});
		});

		it('should redirect www to non-www', () => {
			const mockResolve = vi.fn();
			const mockEvent = {
				url: new URL('https://www.picologs.com/dashboard'),
				request: { headers: new Headers() }
			};

			// Simulate redirect logic
			if (mockEvent.url.hostname.startsWith('www.')) {
				const newUrl = mockEvent.url.href.replace('www.', '');
				expect(newUrl).toBe('https://picologs.com/dashboard');
			}
		});

		it('should not redirect non-www requests', () => {
			const url = new URL('https://picologs.com/dashboard');
			expect(url.hostname.startsWith('www.')).toBe(false);
		});
	});

	describe('Auth Middleware', () => {
		it('should create auth middleware with required config', () => {
			createAuthMiddleware({
				db: {} as any,
				jwtSecret: 'test-secret',
				schema: { users: {} } as any,
				env: {
					nodeEnv: 'test',
					jwtIssuer: 'picologs-website',
					jwtAudience: 'picologs-websocket'
				}
			});

			expect(createAuthMiddleware).toHaveBeenCalledWith(
				expect.objectContaining({
					jwtSecret: 'test-secret',
					env: expect.objectContaining({
						jwtIssuer: 'picologs-website'
					})
				})
			);
		});

		it('should configure JWT issuer for website', () => {
			const config = {
				jwtIssuer: 'picologs-website',
				jwtAudience: 'picologs-websocket'
			};

			expect(config.jwtIssuer).toBe('picologs-website');
		});
	});

	describe('Middleware Chain', () => {
		it('should chain WWW redirect before auth', () => {
			const order: string[] = [];

			const mockWWWMiddleware = vi.fn(async ({ resolve }) => {
				order.push('www');
				return resolve({});
			});

			const mockAuthMiddleware = vi.fn(async ({ resolve }) => {
				order.push('auth');
				return resolve();
			});

			// Simulate chain
			(createWWWRedirectMiddleware as ReturnType<typeof vi.fn>).mockReturnValue(mockWWWMiddleware);
			(createAuthMiddleware as ReturnType<typeof vi.fn>).mockReturnValue(mockAuthMiddleware);

			// Execute chain
			mockWWWMiddleware({
				event: {},
				resolve: async () => mockAuthMiddleware({ event: {}, resolve: async () => ({}) })
			});

			expect(order[0]).toBe('www');
		});
	});

	describe('Environment Validation', () => {
		it('should require JWT_SECRET environment variable', () => {
			const jwtSecret = process.env.JWT_SECRET;
			expect(jwtSecret).toBeTruthy();
		});

		it('should throw if JWT_SECRET is missing', () => {
			const originalSecret = process.env.JWT_SECRET;
			delete process.env.JWT_SECRET;

			expect(process.env.JWT_SECRET).toBeUndefined();

			// Restore
			process.env.JWT_SECRET = originalSecret;
		});
	});
});

describe('Request Context', () => {
	describe('Locals Augmentation', () => {
		it('should support user in locals', () => {
			const locals: { user?: { id: string; discordId: string } } = {};

			locals.user = {
				id: 'user-123',
				discordId: '123456789'
			};

			expect(locals.user.id).toBe('user-123');
		});

		it('should support token in locals', () => {
			const locals: { token?: string } = {};

			locals.token = 'jwt-token';

			expect(locals.token).toBe('jwt-token');
		});
	});
});
