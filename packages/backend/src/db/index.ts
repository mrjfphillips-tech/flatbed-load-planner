import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://ptv_coach:ptv_coach_dev@localhost:5432/ptv_discovery_coach';

// Connection for queries (pooled)
const queryClient = postgres(connectionString);

// Export the drizzle database instance with schema
export const db = drizzle(queryClient, { schema });

// Export schema for use in queries
export { schema };

// Export a function to create a connection for migrations
export function createMigrationClient() {
  return postgres(connectionString, { max: 1 });
}
