import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://ptv_coach:ptv_coach_dev@localhost:5432/ptv_discovery_coach';

async function runMigrations() {
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  console.log('Running migrations...');

  await migrate(db, {
    migrationsFolder: './src/db/migrations',
  });

  console.log('Migrations completed successfully.');

  await migrationClient.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
