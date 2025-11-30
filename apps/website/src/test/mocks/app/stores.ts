/**
 * Mock for $app/stores
 */
export const page = {
	subscribe: (fn: (value: unknown) => void) => {
		fn({ url: new URL('http://localhost/'), params: {} });
		return () => {};
	}
};

export const navigating = {
	subscribe: (fn: (value: unknown) => void) => {
		fn(null);
		return () => {};
	}
};

export const updated = {
	subscribe: (fn: (value: unknown) => void) => {
		fn(false);
		return () => {};
	},
	check: async () => false
};
