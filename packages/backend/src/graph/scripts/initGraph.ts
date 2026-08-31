#!/usr/bin/env tsx
// ─── Graph Schema Initialization Script ──────────────────────────────────────
// Run via: pnpm graph:init
// Creates constraints and indexes in Neo4j for the Canonical Ontology graph.

import 'dotenv/config';
import { initializeGraphSchema } from '../schema.js';
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
    await initializeGraphSchema();
  } catch (error) {
    console.error('✗ Schema initialization failed:', (error as Error).message);
    process.exit(1);
  } finally {
    await closeDriver();
  }
}

main();
