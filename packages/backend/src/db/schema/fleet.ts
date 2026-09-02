import {
  pgTable,
  uuid,
  varchar,
  real,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { unitSystemEnum } from './load-diagram';

// ─── Customer Fleet: Schema ───────────────────────────────────────────────────
// Feature: load-diagram-generator (Customer Fleet)
//
// A named fleet holds vehicles that a load plan can be assigned to. Dimensions
// and weights are stored in CANONICAL units (mm / kg); cost fields are plain
// currency-agnostic numbers and all optional. Reuses the `ld_unit_system` enum.

export const fleets = pgTable(
  'fleets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    displayUnitSystem: unitSystemEnum('display_unit_system').notNull().default('metric'),
    createdBy: varchar('created_by', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('fleets_name_idx').on(table.name),
  })
);

export const fleetVehicles = pgTable(
  'fleet_vehicles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fleetId: uuid('fleet_id')
      .notNull()
      .references(() => fleets.id, { onDelete: 'cascade' }),
    vehicleId: varchar('vehicle_id', { length: 255 }).notNull(),
    vehicleName: varchar('vehicle_name', { length: 255 }).notNull(),
    vehicleAccount: varchar('vehicle_account', { length: 255 }),
    licensePlate: varchar('license_plate', { length: 64 }),
    // Canonical mm / kg.
    maxWeight: real('max_weight_kg').notNull(),
    platformLength: real('platform_length_mm').notNull(),
    platformWidth: real('platform_width_mm').notNull(),
    platformHeight: real('platform_height_mm'), // optional; open flatbed if null
    // Optional cost attributes (currency-agnostic).
    costPerStop: real('cost_per_stop'),
    fixedCost: real('fixed_cost'),
    costPerHour: real('cost_per_hour'),
    costPerKm: real('cost_per_km'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    fleetIdx: index('fleet_vehicles_fleet_idx').on(table.fleetId),
  })
);
