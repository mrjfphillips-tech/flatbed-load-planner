import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  real,
  boolean,
  json,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ─── Load Diagram Generator: Schema ───────────────────────────────────────────
// Feature: load-diagram-generator
//
// All dimension/weight columns store CANONICAL units (mm / kg) regardless of the
// unit system used for entry or display. `*_unit_system` columns record the
// metric/imperial preference for display and the source of uploaded data.
// _Requirements: 2.1, 2.2, 10.1, 10.2_

export const unitSystemEnum = pgEnum('ld_unit_system', ['metric', 'imperial']);

export const trailerTypeEnum = pgEnum('ld_trailer_type', [
  'flatbed',
  'curtainsider',
  'enclosed',
]);

export const ldPlanStatusEnum = pgEnum('ld_plan_status', [
  'draft',
  'computed',
  'reviewed',
  'finalized',
]);

// ─── Trailer Profiles ─────────────────────────────────────────────────────────

export const trailerProfiles = pgTable(
  'trailer_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    // Canonical mm / kg. Stored as real because imperial input converts to
    // fractional millimeters (e.g. 47 in = 1193.8 mm).
    internalLength: real('internal_length_mm').notNull(),
    internalWidth: real('internal_width_mm').notNull(),
    internalHeight: real('internal_height_mm').notNull(),
    maxPayloadWeight: real('max_payload_weight_kg').notNull(),
    axleCount: integer('axle_count').notNull(),
    axleWeightLimits: json('axle_weight_limits').$type<number[]>().notNull(), // kg per axle
    displayUnitSystem: unitSystemEnum('display_unit_system').notNull().default('metric'),
    trailerType: trailerTypeEnum('trailer_type').notNull().default('flatbed'),
    doorConfig: json('door_config').$type<Record<string, unknown>>(),
    isTemplate: boolean('is_template').notNull().default(false),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    templateIdx: index('trailer_profiles_template_idx').on(table.isTemplate),
  })
);

// ─── Load Plans ─────────────────────────────────────────────────────────────────

export const ldLoadPlans = pgTable(
  'ld_load_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Nullable: a plan is tied to EITHER a trailer profile or a fleet vehicle.
    trailerProfileId: uuid('trailer_profile_id').references(() => trailerProfiles.id),
    name: varchar('name', { length: 255 }).notNull(),
    status: ldPlanStatusEnum('status').notNull().default('draft'),
    // Optional assignment of this plan to a specific fleet vehicle. Kept as a
    // plain uuid column (no cross-file FK reference) to avoid a schema import
    // cycle; referential integrity is enforced by the migration.
    fleetVehicleId: uuid('fleet_vehicle_id'),
    sourceUnitSystem: unitSystemEnum('source_unit_system').notNull().default('metric'),
    displayUnitSystem: unitSystemEnum('display_unit_system').notNull().default('metric'),
    totalWeight: real('total_weight_kg'),
    volumeUtilization: real('volume_utilization_percent'),
    axleWeights: json('axle_weights').$type<number[]>(),
    itemCount: integer('item_count'),
    computedAt: timestamp('computed_at', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    optiflowRouteId: text('optiflow_route_id'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    trailerIdx: index('ld_load_plans_trailer_idx').on(table.trailerProfileId),
    statusIdx: index('ld_load_plans_status_idx').on(table.status),
  })
);

// ─── Load Items ─────────────────────────────────────────────────────────────────

export const ldLoadItems = pgTable(
  'ld_load_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loadPlanId: uuid('load_plan_id')
      .notNull()
      .references(() => ldLoadPlans.id, { onDelete: 'cascade' }),
    itemId: varchar('item_id', { length: 255 }).notNull(),
    description: text('description'),
    // Canonical mm / kg. Stored as real because imperial input converts to
    // fractional millimeters (e.g. 47 in = 1193.8 mm).
    length: real('length_mm').notNull(),
    width: real('width_mm').notNull(),
    height: real('height_mm').notNull(),
    weight: real('weight_kg').notNull(),
    quantity: integer('quantity').notNull().default(1),
    stackabilityClass: varchar('stackability_class', { length: 128 }),
    maxStackWeight: real('max_stack_weight_kg'),
    deliveryStop: integer('delivery_stop'),
    temperatureZone: varchar('temperature_zone', { length: 128 }),
    floorOnly: boolean('floor_only').notNull().default(false),
    topLoadProhibited: boolean('top_load_prohibited').notNull().default(false),
    // Computed placement (canonical mm, real for fractional imperial values).
    placedX: real('placed_x_mm'),
    placedY: real('placed_y_mm'),
    placedZ: real('placed_z_mm'),
    placedOrientation: varchar('placed_orientation', { length: 8 }),
    loadSequence: integer('load_sequence'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('ld_load_items_plan_idx').on(table.loadPlanId),
  })
);

// ─── Plan History (Audit Trail) ───────────────────────────────────────────────

export const ldPlanHistory = pgTable(
  'ld_plan_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    loadPlanId: uuid('load_plan_id')
      .notNull()
      .references(() => ldLoadPlans.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 64 }).notNull(), // computed | manual_adjustment | finalized
    previousState: json('previous_state').$type<Record<string, unknown>>(),
    newState: json('new_state').$type<Record<string, unknown>>(),
    adjustedBy: text('adjusted_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('ld_plan_history_plan_idx').on(table.loadPlanId),
  })
);
