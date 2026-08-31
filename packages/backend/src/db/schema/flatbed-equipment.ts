import {
  pgTable,
  uuid,
  varchar,
  real,
  integer,
  boolean,
  json,
  timestamp,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { flatbedUsers } from './flatbed-users';

// ─── Flatbed Load Planner: Equipment (Trailers & Tractors) ────────────────────

export const deckMaterialEnum = pgEnum('deck_material', ['steel', 'aluminum', 'wood']);

export const equipmentTrailers = pgTable(
  'equipment_trailers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    lengthFt: real('length_ft').notNull(),
    deckWidthIn: real('deck_width_in').notNull(),
    deckHeightIn: real('deck_height_in').notNull(),
    maxGrossWeight: real('max_gross_weight').notNull(),
    tareWeight: real('tare_weight').notNull(),
    axleCount: integer('axle_count').notNull(),
    axlePositions: json('axle_positions').$type<number[]>().notNull(), // distances from kingpin in inches
    axleWeightRatings: json('axle_weight_ratings').$type<number[]>().notNull(), // per axle group
    kingpinPosition: real('kingpin_position').notNull(), // inches from front
    rearOverhangLimit: real('rear_overhang_limit').notNull(),
    deckMaterial: deckMaterialEnum('deck_material').notNull().default('steel'),
    stakePockets: json('stake_pockets').$type<{ x: number; y: number }[]>().notNull(),
    anchorPoints: json('anchor_points').$type<{ x: number; y: number }[]>().notNull(),
    maxConcentratedLoadPsf: real('max_concentrated_load_psf').notNull(),
    isTemplate: boolean('is_template').notNull().default(false),
    createdBy: uuid('created_by').references(() => flatbedUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    templateIdx: index('equipment_trailers_template_idx').on(table.isTemplate),
    createdByIdx: index('equipment_trailers_created_by_idx').on(table.createdBy),
  })
);

export const equipmentTractors = pgTable(
  'equipment_tractors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    steerAxleRating: real('steer_axle_rating').notNull(),
    driveAxleRating: real('drive_axle_rating').notNull(),
    fifthWheelPosition: real('fifth_wheel_position').notNull(), // from front of tractor
    tareWeight: real('tare_weight').notNull(),
    driveAxleCount: integer('drive_axle_count').notNull().default(2), // 1 (single) or 2 (tandem)
    createdBy: uuid('created_by').references(() => flatbedUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdByIdx: index('equipment_tractors_created_by_idx').on(table.createdBy),
  })
);
