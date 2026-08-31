import postgres from 'postgres';

const sql = postgres('postgresql://neondb_owner:npg_KuD3PfecMA4i@ep-bold-snow-amvxemmt.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require');

try {
  const result = await sql`SELECT 1 as test`;
  console.log('DB CONNECTED:', JSON.stringify(result));
  await sql.end();
  process.exit(0);
} catch (e) {
  console.log('DB ERROR:', e.message);
  await sql.end();
  process.exit(1);
}
