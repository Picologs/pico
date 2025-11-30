import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './drizzle',
	schema: '../../packages/types/src/database/schema.ts',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL!
	}
});
