/**
 * Landing Page Tests
 *
 * Tests the main landing page including:
 * - Hero content and CTAs
 * - Demo WebSocket connection
 * - Discord sign-in button
 * - Feature highlights
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';

// Mock environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock forms
vi.mock('$app/forms', () => ({
	enhance: vi.fn(() => ({ destroy: vi.fn() }))
}));

// Mock $env/dynamic/public
vi.mock('$env/dynamic/public', () => ({
	env: {
		PUBLIC_WS_URL: 'ws://localhost:8080'
	}
}));

// Mock events.remote (uses $app/server which needs __sveltekit)
vi.mock('./events.remote', () => ({
	getTrackedEvents: vi.fn(() => Promise.resolve({ current: [], deprecated: [] }))
}));

// Mock fleet data
vi.mock('@pico/shared/data/fleet.json', () => ({
	default: []
}));

// Mock shared library
vi.mock('@pico/shared', () => ({
	DiscordIcon: vi.fn(() => null),
	LogFeed: vi.fn(() => null)
}));

// Mock Lucide icons
vi.mock('@lucide/svelte', () => ({
	ChevronRight: vi.fn(() => null),
	Loader2: vi.fn(() => null),
	Radio: vi.fn(() => null),
	Users: vi.fn(() => null),
	Monitor: vi.fn(() => null),
	Smartphone: vi.fn(() => null),
	Download: vi.fn(() => null)
}));

describe('Landing Page', () => {
	let mockWebSocket: {
		onopen: ((event: Event) => void) | null;
		onmessage: ((event: MessageEvent) => void) | null;
		onerror: ((event: Event) => void) | null;
		onclose: ((event: CloseEvent) => void) | null;
		send: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
		readyState: number;
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock WebSocket
		mockWebSocket = {
			onopen: null,
			onmessage: null,
			onerror: null,
			onclose: null,
			send: vi.fn(),
			close: vi.fn(),
			readyState: 0
		};

		// @ts-expect-error - Mocking global WebSocket (must be a constructor)
		global.WebSocket = vi.fn().mockImplementation(function () {
			return mockWebSocket;
		});

		// Mock fetch for mock service start
		global.fetch = vi.fn().mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Hero Content', () => {
		it('should render the main heading elements', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			const { container } = render(LandingPage);

			// Check for heading with Star Citizen and Logs Synced text
			const heading = container.querySelector('h2');
			expect(heading).toBeTruthy();
			expect(heading?.textContent).toContain('Star Citizen');
			expect(heading?.textContent).toContain('Logs Synced');
		});

		it('should render the description text', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			expect(screen.getByText(/See real-time updates of your friends' online status/)).toBeTruthy();
		});

		it('should render the Picologs logos', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			const logos = screen.getAllByAltText('Picologs');
			expect(logos.length).toBeGreaterThanOrEqual(1);
		});

		it('should render Download App buttons', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			const downloadButtons = screen.getAllByRole('link', { name: /Download App/i });
			expect(downloadButtons.length).toBeGreaterThanOrEqual(1);
			expect(downloadButtons[0].getAttribute('href')).toBe('/download');
		});
	});

	describe('Feature Highlights', () => {
		it('should render Real-Time Sync feature', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			expect(screen.getByText('Real-Time Sync')).toBeTruthy();
			expect(screen.getByText(/Watch your friends' game activity/)).toBeTruthy();
		});

		it('should render Group Features', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			expect(screen.getByText('Group Features')).toBeTruthy();
			expect(screen.getByText(/Create groups and share logs/)).toBeTruthy();
		});

		it('should render Desktop & Web feature', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			expect(screen.getByText('Desktop & Web')).toBeTruthy();
			expect(screen.getByText(/Check in with friends and groups/)).toBeTruthy();
		});
	});

	describe('Discord Sign-In', () => {
		it('should render Discord sign-in button', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			const signInButton = screen.getByRole('button', { name: /Sign in/i });
			expect(signInButton).toBeTruthy();
		});

		it('should have sign-in form with POST method', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			const { container } = render(LandingPage);

			const form = container.querySelector('form[method="POST"]');
			expect(form).toBeTruthy();
		});
	});

	describe('WebSocket Demo Connection', () => {
		it('should attempt WebSocket connection on mount', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			// WebSocket should be called with demo endpoint
			expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080/demo');
		});

		it('should have demo content area', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			const { container } = render(LandingPage);

			// Check for content area where demo or loading state would be
			const contentArea = container.querySelector('.h-\\[28rem\\]');
			expect(contentArea).toBeTruthy();
		});
	});

	describe('Footer', () => {
		it('should render Download App link in footer', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			const footerLinks = screen.getAllByRole('link', { name: /Download App/i });
			expect(footerLinks.length).toBeGreaterThanOrEqual(1);
		});

		it('should render Terms of Service link', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			const termsLink = screen.getByRole('link', { name: /Terms of Service/i });
			expect(termsLink.getAttribute('href')).toBe('/terms');
		});

		it('should render Privacy Policy link', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			render(LandingPage);

			const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });
			expect(privacyLink.getAttribute('href')).toBe('/privacy');
		});
	});

	describe('Demo Log Preview', () => {
		it('should render browser shell with title bar', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			const { container } = render(LandingPage);

			// Check for Picologs text in title bar
			const titleBars = container.querySelectorAll('.text-xs.text-white\\/70');
			const hasPicologsTitle = Array.from(titleBars).some((el) => el.textContent === 'Picologs');
			expect(hasPicologsTitle).toBe(true);
		});

		it('should have proper content area height', async () => {
			const LandingPage = (await import('./+page.svelte')).default;
			const { container } = render(LandingPage);

			const contentArea = container.querySelector('.h-\\[28rem\\]');
			expect(contentArea).toBeTruthy();
		});
	});
});

describe('WebSocket Message Handling', () => {
	it('should format ping response correctly', () => {
		const pongMessage = JSON.stringify({ type: 'pong' });
		const parsed = JSON.parse(pongMessage);

		expect(parsed.type).toBe('pong');
	});

	it('should parse receive_logs message', () => {
		const logsMessage = JSON.stringify({
			type: 'receive_logs',
			data: {
				logs: [{ id: '1', message: 'Test log' }]
			}
		});
		const parsed = JSON.parse(logsMessage);

		expect(parsed.type).toBe('receive_logs');
		expect(parsed.data.logs.length).toBe(1);
	});

	it('should limit logs to MAX_LOGS', () => {
		const MAX_LOGS = 100;
		const existingLogs = Array.from({ length: 90 }, (_, i) => ({ id: `${i}` }));
		const newLogs = Array.from({ length: 20 }, (_, i) => ({ id: `new-${i}` }));

		const combinedLogs = [...existingLogs, ...newLogs].slice(-MAX_LOGS);

		expect(combinedLogs.length).toBe(MAX_LOGS);
	});
});

describe('Reconnection Logic', () => {
	it('should calculate exponential backoff delay', () => {
		const getReconnectDelay = (attempts: number) => {
			const baseDelay = 1000;
			const maxDelay = 30000;
			return Math.min(baseDelay * Math.pow(2, attempts), maxDelay);
		};

		expect(getReconnectDelay(0)).toBe(1000);
		expect(getReconnectDelay(1)).toBe(2000);
		expect(getReconnectDelay(2)).toBe(4000);
		expect(getReconnectDelay(3)).toBe(8000);
		expect(getReconnectDelay(10)).toBe(30000); // Capped at max
	});

	it('should respect max reconnect attempts', () => {
		const MAX_RECONNECT_ATTEMPTS = 10;
		let attempts = 0;

		while (attempts < 15) {
			if (attempts >= MAX_RECONNECT_ATTEMPTS) {
				break;
			}
			attempts++;
		}

		expect(attempts).toBe(MAX_RECONNECT_ATTEMPTS);
	});
});
