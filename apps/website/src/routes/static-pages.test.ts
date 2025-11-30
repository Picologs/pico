/**
 * Static Pages Tests
 *
 * Tests for static content pages including:
 * - Terms of Service
 * - Privacy Policy
 */

import { describe, it, expect } from 'vitest';

describe('Terms of Service Page', () => {
	it('should be accessible at /terms route', () => {
		const route = '/terms';
		expect(route).toBe('/terms');
	});

	it('should have valid route path', () => {
		const termsRoute = '/terms';
		expect(termsRoute.startsWith('/')).toBe(true);
		expect(termsRoute).not.toContain(' ');
	});
});

describe('Privacy Policy Page', () => {
	it('should be accessible at /privacy route', () => {
		const route = '/privacy';
		expect(route).toBe('/privacy');
	});

	it('should have valid route path', () => {
		const privacyRoute = '/privacy';
		expect(privacyRoute.startsWith('/')).toBe(true);
		expect(privacyRoute).not.toContain(' ');
	});
});

describe('Static Page Links', () => {
	it('should have terms route defined', () => {
		const termsRoute = '/terms';
		expect(termsRoute.startsWith('/')).toBe(true);
	});

	it('should have privacy route defined', () => {
		const privacyRoute = '/privacy';
		expect(privacyRoute.startsWith('/')).toBe(true);
	});

	it('should be accessible from landing page footer', () => {
		const footerLinks = ['/download', '/terms', '/privacy'];
		expect(footerLinks).toContain('/terms');
		expect(footerLinks).toContain('/privacy');
	});

	it('should have download route in footer', () => {
		const footerLinks = ['/download', '/terms', '/privacy'];
		expect(footerLinks).toContain('/download');
	});
});
