/**
 * Database connection
 *
 * Creates a neon-http database instance for use with middleware
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL;

// Conditionally initialize database connection
// During build time, DATABASE_URL is not available - this is expected
// At runtime, if DATABASE_URL is missing and db is accessed, error will be thrown
let dbInstance;

if (DATABASE_URL) {
	const sql = neon(DATABASE_URL);
	dbInstance = drizzle(sql, { schema });
} else {
	// Defer error until database is actually accessed (allows build to proceed)
	dbInstance = new Proxy({} as any, {
		get() {
			throw new Error('DATABASE_URL environment variable is required');
		}
	});
}

export const db = dbInstance;
export { schema };
export type { LogPattern, LogPatternExample, LogTag, LogPatternReport } from './schema';
