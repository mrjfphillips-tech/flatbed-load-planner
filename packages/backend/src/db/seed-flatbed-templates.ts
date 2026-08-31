/**
 * Seed script for Flatbed Load Planner standard trailer templates.
 *
 * Seeds 48-foot and 53-foot standard flatbed trailer configurations
 * as pre-loaded templates per Requirement 1.2.
 *
 * Usage:
 *   npx tsx src/db/seed-flatbed-templates.ts
 *
 * Prerequisites:
 *   - PostgreSQL database running with DATABASE_URL configured
 *   - Migrations have been applied (npm run db:migrate)
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import postgres from 'postgres';
import { equipmentTrailers } from './schema/flatbed-equipment';

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://ptv_coach:ptv_coach_dev@localhost:5432/ptv_discovery_coach';

// Standard stake pocket positions for a flatbed trailer (x,y in inches from kingpin)
// Pockets are typically every 24 inches along both edges of the deck
function generateStakePockets(deckLengthIn: number, deckWidthIn: number) {
  const pockets: { x: number; y: number }[] = [];
  const spacing = 24; // 24-inch spacing standard
  const halfWidth = deckWidthIn / 2;

  for (let x = 12; x <= deckLengthIn; x += spacing) {
    // Left edge
    pockets.push({ x, y: -halfWidth });
    // Right edge
    pockets.push({ x, y: halfWidth });
  }
  return pockets;
}

// Standard anchor points (D-rings) along deck edges and center
function generateAnchorPoints(deckLengthIn: number, deckWidthIn: number) {
  const points: { x: number; y: number }[] = [];
  const spacing = 48; // 48-inch spacing for anchor points
  const halfWidth = deckWidthIn / 2;

  for (let x = 24; x <= deckLengthIn; x += spacing) {
    // Left edge
    points.push({ x, y: -halfWidth + 3 });
    // Right edge
    points.push({ x, y: halfWidth - 3 });
  }
  return points;
}

const trailerTemplates = [
  {
    name: '48-Foot Standard Flatbed',
    lengthFt: 48,
    deckWidthIn: 96, // 8 feet = 96 inches standard width
    deckHeightIn: 60, // approximately 60 inches from ground
    maxGrossWeight: 80000, // Federal bridge formula max GVW
    tareWeight: 12500, // typical 48ft flatbed tare
    axleCount: 2,
    axlePositions: [480, 528], // tandem axles near rear, inches from kingpin (40ft and 44ft)
    axleWeightRatings: [34000, 34000], // 34,000 lbs per tandem axle group
    kingpinPosition: 24, // 24 inches from front of trailer
    rearOverhangLimit: 48, // 4 feet max rear overhang
    deckMaterial: 'steel' as const,
    stakePockets: generateStakePockets(576, 96), // 48ft = 576in
    anchorPoints: generateAnchorPoints(576, 96),
    maxConcentratedLoadPsf: 500, // 500 PSF rated deck
    isTemplate: true,
  },
  {
    name: '53-Foot Standard Flatbed',
    lengthFt: 53,
    deckWidthIn: 102, // 102 inches (8.5ft) - max legal width
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 13500, // typical 53ft flatbed tare (slightly heavier)
    axleCount: 2,
    axlePositions: [528, 576], // tandem axles near rear, inches from kingpin (44ft and 48ft)
    axleWeightRatings: [34000, 34000],
    kingpinPosition: 24,
    rearOverhangLimit: 48,
    deckMaterial: 'steel' as const,
    stakePockets: generateStakePockets(636, 102), // 53ft = 636in
    anchorPoints: generateAnchorPoints(636, 102),
    maxConcentratedLoadPsf: 500,
    isTemplate: true,
  },
];

async function seedTrailerTemplates() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log('Seeding flatbed trailer templates...');

  for (const template of trailerTemplates) {
    // Check if a template with this name already exists
    const existing = await db
      .select({ id: equipmentTrailers.id })
      .from(equipmentTrailers)
      .where(
        and(
          eq(equipmentTrailers.name, template.name),
          eq(equipmentTrailers.isTemplate, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`  – Skipped (already exists): ${template.name}`);
      continue;
    }

    await db.insert(equipmentTrailers).values(template);
    console.log(`  ✓ Seeded: ${template.name}`);
  }

  console.log('Trailer template seeding complete.');
  await client.end();
  process.exit(0);
}

seedTrailerTemplates().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
