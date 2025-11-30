// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { UserProfile } from '@pico/types';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: UserProfile;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
