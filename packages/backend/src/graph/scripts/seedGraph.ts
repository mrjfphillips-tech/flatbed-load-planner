#!/usr/bin/env tsx
// ─── Graph Seed Script ───────────────────────────────────────────────────────
// Run via: pnpm graph:seed
// Seeds the Canonical Ontology graph with canonical fields, frameworks,
// framework-native fields, and crosswalk mappings for all seven frameworks.

import 'dotenv/config';
import { seedGraphData } from '../seed.js';
import { verifyConnectivity, closeDriver } from '../neo4jClient.js';

async function main(): Promise<void> {
  console.log('Connecting to Neo4j...');
  try {
    await verifyConnectivity();
    console.log('✓ Connected to Neo4j');
  } catch (error) {
    console.error('✗ Failed to connect to Neo4j:', (error as Error).message);
    console.error('  Ensure Neo4j is running (docker compose up neo4j)');
    process.exit(1);
  }

  try {
    await seedGraphData();
  } catch (error) {
    console.error('✗ Graph seeding failed:', (error as Error).message);
    process.exit(1);
  } finally {
    await closeDriver();
  }
}

main();
