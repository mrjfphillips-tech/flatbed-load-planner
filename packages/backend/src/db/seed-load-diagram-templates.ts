/**
 * Seed script for Load Diagram Generator trailer profile templates.
 *
 * Seeds the European (metric) and North American (imperial) trailer templates
 * defined in the shared package. All dimensions are stored canonically in
 * mm / kg; each template records its native display unit system.
 * _Requirements: 2.2, 10.1, 10.2_
 *
 * Usage:
 *   npx tsx src/db/seed-load-diagram-templates.ts
 *
 * Prerequisites:
 *   - DATABASE_URL configured
 *   - Migrations applied (npm run db:migrate)
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import postgres from 'postgres';
import { trailerProfiles } from './schema/load-diagram';
import { loadDiagram } from '@ptv-discovery-coach/shared';

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://optiflow:optiflow_dev@localhost:5432/optiflow_load_planner';

async function seedTrailerProfileTemplates() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('Seeding load-diagram trailer profile templates...');

  for (const t of loadDiagram.TRAILER_TEMPLATES) {
    const existing = await db
      .select({ id: trailerProfiles.id })
      .from(trailerProfiles)
      .where(
        and(eq(trailerProfiles.name, t.name), eq(trailerProfiles.isTemplate, true)),
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`  - Skipped (already exists): ${t.name}`);
      continue;
    }

    await db.insert(trailerProfiles).values({
      name: t.name,
      internalLength: t.internalLength,
      internalWidth: t.internalWidth,
      internalHeight: t.internalHeight,
      maxPayloadWeight: t.maxPayloadWeight,
      axleCount: t.axleCount,
      axleWeightLimits: t.axleWeightLimits,
      displayUnitSystem: t.displayUnitSystem,
      doorConfig: t.doorConfig as unknown as Record<string, unknown>,
      isTemplate: true,
    });
    console.log(`  + Seeded: ${t.name} (${t.displayUnitSystem})`);
  }

  console.log('Load-diagram trailer template seeding complete.');
  await client.end();
  process.exit(0);
}

seedTrailerProfileTemplates().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
