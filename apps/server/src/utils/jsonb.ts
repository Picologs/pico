import { sql, type SQL } from "drizzle-orm";
import { type AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Create a SQL condition to match a JSONB field value
 *
 * PostgreSQL JSONB operator: ->> extracts JSON object field as text
 *
 * @example
 * // Query notifications where data.invitationId = '123'
 * db.select()
 *   .from(notifications)
 *   .where(jsonbFieldEquals(notifications.data, 'invitationId', '123'))
 *
 * @param column - The JSONB column to query
 * @param field - The field name within the JSONB object
 * @param value - The value to match (will be parameterized)
 * @returns SQL condition for use in .where() clauses
 */
export function jsonbFieldEquals(
  column: AnyPgColumn,
  field: string,
  value: string | number,
): SQL {
  return sql`${column}->>${field} = ${value}`;
}

/**
 * Create a SQL condition to check if a JSONB field exists
 *
 * @param column - The JSONB column to query
 * @param field - The field name to check for existence
 * @returns SQL condition for use in .where() clauses
 */
export function jsonbFieldExists(column: AnyPgColumn, field: string): SQL {
  return sql`${column} ? ${field}`;
}

/**
 * Create a SQL condition to match a nested JSONB field value
 *
 * @example
 * // Query where data.user.id = '123'
 * jsonbNestedFieldEquals(notifications.data, ['user', 'id'], '123')
 *
 * @param column - The JSONB column to query
 * @param path - Array of field names representing the path
 * @param value - The value to match
 * @returns SQL condition for use in .where() clauses
 */
export function jsonbNestedFieldEquals(
  column: AnyPgColumn,
  path: string[],
  value: string | number,
): SQL {
  const pathStr = path.join(",");
  return sql`${column}#>>${pathStr} = ${value}`;
}
