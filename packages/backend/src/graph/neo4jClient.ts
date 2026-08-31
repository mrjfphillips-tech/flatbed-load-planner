// ─── Neo4j Client Connection ──────────────────────────────────────────────────
// Provides a singleton Neo4j driver instance for the application.

import neo4j, { Driver, Session } from 'neo4j-driver';

export interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

const DEFAULT_CONFIG: Neo4jConfig = {
  uri: process.env.NEO4J_URI ?? 'bolt://localhost:7687',
  user: process.env.NEO4J_USER ?? 'neo4j',
  password: process.env.NEO4J_PASSWORD ?? 'ptv_coach_dev',
};

let driver: Driver | null = null;

/**
 * Get or create the singleton Neo4j driver instance.
 */
export function getDriver(config: Neo4jConfig = DEFAULT_CONFIG): Driver {
  if (!driver) {
    driver = neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password));
  }
  return driver;
}

/**
 * Open a new Neo4j session (caller is responsible for closing it).
 */
export function getSession(config?: Neo4jConfig): Session {
  return getDriver(config).session();
}

/**
 * Close the Neo4j driver. Call on application shutdown.
 */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/**
 * Verify connectivity to Neo4j. Throws if connection fails.
 */
export async function verifyConnectivity(config?: Neo4jConfig): Promise<void> {
  const d = getDriver(config);
  await d.verifyConnectivity();
}
