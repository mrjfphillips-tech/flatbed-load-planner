import { pgTable, uuid, varchar, text, timestamp, real, jsonb, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { pdifSessions } from './pdif-sessions';

/**
 * Discovery Graph Nodes — Every fact, contact, process, system, pain point,
 * and objective the platform learns about a customer's transportation operation.
 *
 * This is the platform's memory. Nothing is ever deleted — only updated.
 */
export const discoveryGraphNodes = pgTable(
  'discovery_graph_nodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => pdifSessions.id),

    // What kind of thing is this?
    nodeType: varchar('node_type', { length: 50 }).notNull(),
    // 'fact' | 'contact' | 'process' | 'system' | 'pain_point' |
    // 'objective' | 'constraint' | 'metric' | 'asset' | 'vendor'

    // Human-readable label for this node
    label: text('label').notNull(),

    // Structured properties (varies by node type)
    // Examples:
    //   fact: { value: "200 trucks", unit: "vehicles", qualifier: "approximately" }
    //   contact: { name: "John Smith", title: "VP Operations", level: "vp" }
    //   process: { name: "Route Planning", method: "manual", frequency: "daily" }
    //   system: { vendor: "Blue Yonder", product: "TMS", version: null }
    //   pain_point: { description: "...", category: "fleet_utilization", severity: "high" }
    //   metric: { name: "On-Time Delivery", value: 87, unit: "percent", target: 95 }
    //   asset: { type: "truck", count: 200, ownership: "owned" }
    properties: jsonb('properties').default('{}').notNull(),

    // How sure are we about this? (0.0 - 1.0)
    // Only increases when actual EVIDENCE is captured, not just when a question is asked
    confidence: real('confidence').default(0.5).notNull(),

    // The raw transcript text that established this node
    evidenceText: text('evidence_text'),

    // Who said it and when (for source authority weighting)
    evidenceSource: varchar('evidence_source', { length: 50 }).default('transcript').notNull(),
    // 'transcript' | 'document' | 'inference' | 'cross_account_pattern'

    // Temporal validity — when was this true?
    validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow().notNull(),
    validUntil: timestamp('valid_until', { withTimezone: true }), // null = still current

    // Version tracking — how many times has this node been updated?
    version: real('version').default(1).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('graph_nodes_account_id_idx').on(table.accountId),
    sessionIdx: index('graph_nodes_session_id_idx').on(table.sessionId),
    nodeTypeIdx: index('graph_nodes_node_type_idx').on(table.nodeType),
    validIdx: index('graph_nodes_valid_idx').on(table.validUntil),
  })
);

/**
 * Discovery Graph Edges — Relationships between nodes.
 * How things connect: "Fleet USES ManualPlanning", "ManualPlanning CAUSES RouteInefficiency"
 */
export const discoveryGraphEdges = pgTable(
  'discovery_graph_edges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => pdifSessions.id),

    sourceNodeId: uuid('source_node_id')
      .notNull()
      .references(() => discoveryGraphNodes.id),
    targetNodeId: uuid('target_node_id')
      .notNull()
      .references(() => discoveryGraphNodes.id),

    // What is the nature of this relationship?
    edgeType: varchar('edge_type', { length: 50 }).notNull(),
    // 'causes' | 'depends_on' | 'contradicts' | 'supports' | 'reports_to' |
    // 'owns' | 'uses' | 'impacts' | 'solves' | 'measures' | 'replaces'

    // How strong is this relationship? (0.0 - 1.0)
    confidence: real('confidence').default(0.7).notNull(),

    // Any additional context about this relationship
    properties: jsonb('properties').default('{}').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('graph_edges_account_id_idx').on(table.accountId),
    sourceIdx: index('graph_edges_source_idx').on(table.sourceNodeId),
    targetIdx: index('graph_edges_target_idx').on(table.targetNodeId),
    edgeTypeIdx: index('graph_edges_type_idx').on(table.edgeType),
  })
);
