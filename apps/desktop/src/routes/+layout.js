// Disable SSR but enable prerendering for Tauri app
// Tauri apps should be pure SPAs running entirely in the WebView
// Prerendering is required to generate proper static structure for all routes
// See: https://v2.tauri.app/start/frontend/sveltekit/
export const ssr = false;
export const prerender = true;
export const trailingSlash = 'ignore'; // Handle routes consistently with/without trailing slashes
