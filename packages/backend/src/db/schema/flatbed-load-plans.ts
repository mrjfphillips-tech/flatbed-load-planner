import {
  pgTable,
  uuid,
  varchar,
  integer,
  real,
  json,
  timestamp,
  text,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { flatbedUsers } from './flatbed-users';
import { equipmentTrailers, equipmentTractors } from './flatbed-equipment';

// ─── Flatbed Load Planner: Load Plans & Versions ──────────────────────────────

export const planStatusEnum = pgEnum('plan_status', [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'superseded',
]);

export const loadPatternEnum = pgEnum('load_pattern', [
  'layered',
  'column_building',
  'row_building',
  'long_product',
  'nested',
  'customer_zoning',
  'mixed',
]);

export const loadPlans = pgTable(
  'load_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => flatbedUsers.id),
    trailerId: uuid('trailer_id')
      .notNull()
      .references(() => equipmentTrailers.id),
    tractorId: uuid('tractor_id')
      .notNull()
      .references(() => equipmentTractors.id),
    currentVersion: integer('current_version').notNull().default(1),
    status: planStatusEnum('status').notNull().default('draft'),
    pattern: loadPatternEnum('pattern'),
    freightManifest: json('freight_manifest').$type<Record<string, unknown>[]>(),
    multiLoadSetId: uuid('multi_load_set_id').references(() => multiLoadSets.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdByIdx: index('load_plans_created_by_idx').on(table.createdBy),
    statusIdx: index('load_plans_status_idx').on(table.status),
    multiLoadSetIdx: index('load_plans_multi_load_set_idx').on(table.multiLoadSetId),
  })
);

export const planVersions = pgTable(
  'plan_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => loadPlans.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    status: planStatusEnum('version_status').notNull().default('draft'),
    placedFreight: json('placed_freight').$type<Record<string, unknown>[]>(),
    weightMetrics: json('weight_metrics').$type<Record<string, unknown>>(),
    securementPlan: json('securement_plan').$type<Record<string, unknown>>(),
    loadingSequence: json('loading_sequence').$type<Record<string, unknown>[]>(),
    warnings: json('warnings').$type<Record<string, unknown>[]>(),
    createdBy: uuid('created_by').references(() => flatbedUsers.id),
    approvedBy: uuid('approved_by').references(() => flatbedUsers.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planVersionIdx: index('plan_versions_plan_id_idx').on(table.planId),
    versionNumberIdx: index('plan_versions_version_number_idx').on(
      table.planId,
      table.versionNumber
    ),
  })
);

// ─── Multi-Load Sets ──────────────────────────────────────────────────────────

export const multiLoadSets = pgTable(
  'multi_load_sets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }),
    description: text('description'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => flatbedUsers.id),
    totalFreightCount: integer('total_freight_count'),
    totalWeight: real('total_weight'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdByIdx: index('multi_load_sets_created_by_idx').on(table.createdBy),
  })
);
