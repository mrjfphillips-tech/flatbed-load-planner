import postgres from 'postgres';

const DATABASE_URL = 'postgresql://neondb_owner:npg_KuD3PfecMA4i@ep-bold-snow-amvxemmt.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(DATABASE_URL);

// Enable pgvector extension
await sql`CREATE EXTENSION IF NOT EXISTS vector`;
console.log('pgvector extension enabled');
await sql.end();

// Drop all tables in public schema
const tables = await sql`
  SELECT tablename FROM pg_tables WHERE schemaname = 'public'
`;

console.log(`Found ${tables.length} tables to drop...`);

for (const { tablename } of tables) {
  await sql.unsafe(`DROP TABLE IF EXISTS "${tablename}" CASCADE`);
  console.log(`  Dropped: ${tablename}`);
}

console.log('All tables dropped. Ready for fresh schema push.');
await sql.end();
