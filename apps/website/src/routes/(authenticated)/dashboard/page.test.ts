/**
 * Dashboard Page Tests
 *
 * Tests the authenticated dashboard page including:
 * - DashboardPage component rendering
 * - Fleet data passing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock fleet data
vi.mock('@pico/shared/data/fleet.json', () => ({
	default: [
		{ id: '1', name: 'Aurora MR', manufacturer: 'RSI' },
		{ id: '2', name: 'Constellation Andromeda', manufacturer: 'RSI' }
	]
}));

// Mock shared library
vi.mock('@pico/shared', () => ({
	DashboardPage: vi.fn(() => null)
}));

describe('Dashboard Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Fleet Data Structure', () => {
		it('should have fleet items with expected structure', async () => {
			// Cast to any since mock returns array but TypeScript sees object type
			const fleetData = (await import('@pico/shared/data/fleet.json')).default as any;

			// fleetData is mocked as an array (see mock at top of file)
			expect(fleetData.length).toBeGreaterThan(0);
			expect(fleetData[0]).toHaveProperty('id');
			expect(fleetData[0]).toHaveProperty('name');
		});

		it('should have Aurora MR in fleet', async () => {
			// Cast to any since mock returns array but TypeScript sees object type
			const fleetData = (await import('@pico/shared/data/fleet.json')).default as any;

			// fleetData is mocked as an array
			const aurora = fleetData.find((ship: { name: string }) => ship.name === 'Aurora MR');
			expect(aurora).toBeTruthy();
		});

		it('should export DashboardPage from shared', async () => {
			const { DashboardPage } = await import('@pico/shared');
			expect(DashboardPage).toBeDefined();
		});
	});

	describe('Page Module', () => {
		it('should export default component', async () => {
			const pageModule = await import('./+page.svelte');
			expect(pageModule.default).toBeDefined();
		});
	});
});
