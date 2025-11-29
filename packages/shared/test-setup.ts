/**
 * Global test setup for Bun test runner
 *
 * This file is loaded before all tests via --preload flag
 * It provides mock implementations of Svelte 5 runes which are
 * compiler-injected globals not available in the test environment
 */

// Mock Svelte 5 runes at the global level
// These are compiler-injected globals, not module exports
// We must define them before any .svelte.ts files are evaluated

// Mock $state - returns the initial value directly (non-reactive in tests)
(globalThis as any).$state = <T>(initial: T): T => initial;

// Mock $derived - can accept either a value or a function
// In Svelte 5, $derived(expression) is shorthand for $derived(() => expression)
(globalThis as any).$derived = (valueOrFn: any) => {
  // If it's a function, call it and return the result
  if (typeof valueOrFn === "function") {
    return valueOrFn();
  }
  // Otherwise, return the value directly
  return valueOrFn;
};

// Mock $derived.by - explicitly takes a function
(globalThis as any).$derived.by = (fn: () => any) => fn();

// Mock $effect - skip execution in tests (no reactivity needed)
(globalThis as any).$effect = (_fn: () => void) => {
  // In tests, we don't need reactivity, so we skip execution
  // Effects are tested via their side effects in component integration tests
};

console.log("[test-setup] Svelte 5 runes mocked successfully");
