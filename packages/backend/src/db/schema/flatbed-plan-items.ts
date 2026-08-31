import {
  pgTable,
  uuid,
  varchar,
  integer,
  real,
  json,
  timestamp,
  text,
  boolean,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { loadPlans } from './flatbed-load-plans';

// ─── Flatbed Load Planner: Plan Items, Warnings, Securement ───────────────────

export const warningSeverityEnum = pgEnum('warning_severity', ['error', 'warning', 'info']);

export const securementTypeEnum = pgEnum('securement_type', [
  'chain',
  'strap',
  'chain_with_binder',
]);

export const planItems = pgTable(
  'plan_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => loadPlans.id, { onDelete: 'cascade' }),
    orderNumber: varchar('order_number', { length: 100 }).notNull(),
    customerName: varchar('customer_name', { length: 255 }),
    deliveryStop: integer('delivery_stop').notNull(),
    productType: varchar('product_type', { length: 100 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    pieceWeight: real('piece_weight').notNull(), // lbs
    totalLineWeight: real('total_line_weight').notNull(),
    // Dimensions in inches
    dimensionLength: real('dimension_length').notNull(),
    dimensionWidth: real('dimension_width').notNull(),
    dimensionHeight: real('dimension_height').notNull(),
    // Placement coordinates (relative to deck origin at kingpin)
    positionX: real('position_x'),
    positionY: real('position_y'),
    positionZ: real('position_z'),
    orientation: varchar('orientation', { length: 20 }), // 'longitudinal' | 'transverse'
    layer: integer('layer').default(0), // 0 = deck level
    supportMethod: varchar('support_method', { length: 50 }), // 'direct_to_deck' | 'on_dunnage' | 'on_prior_layer'
    // Handling and stacking
    handlingMethod: varchar('handling_method', { length: 20 }).notNull(), // 'crane' | 'forklift' | 'magnet' | 'manual'
    stackPermission: varchar('stack_permission', { length: 20 }).notNull(), // 'yes' | 'no' | 'conditional'
    maxStackHeight: real('max_stack_height'),
    maxStackWeight: real('max_stack_weight'),
    orientationRequirement: varchar('orientation_requirement', { length: 20 }), // 'longitudinal' | 'transverse' | 'any'
    dunnageRequired: boolean('dunnage_required').notNull().default(false),
    specialNotes: text('special_notes'),
    // Geometric type (computed)
    geometricType: varchar('geometric_type', { length: 50 }),
    contactFootprint: json('contact_footprint').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('plan_items_plan_id_idx').on(table.planId),
    orderIdx: index('plan_items_order_number_idx').on(table.orderNumber),
    stopIdx: index('plan_items_delivery_stop_idx').on(table.planId, table.deliveryStop),
  })
);

export const planWarnings = pgTable(
  'plan_warnings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => loadPlans.id, { onDelete: 'cascade' }),
    ruleId: varchar('rule_id', { length: 100 }),
    severity: warningSeverityEnum('severity').notNull(),
    message: text('message').notNull(),
    affectedItems: json('affected_items').$type<string[]>(), // order numbers
    threshold: real('threshold'),
    actual: real('actual'),
    suggestedAction: text('suggested_action'),
    acknowledged: boolean('acknowledged').notNull().default(false),
    acknowledgedBy: uuid('acknowledged_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('plan_warnings_plan_id_idx').on(table.planId),
    severityIdx: index('plan_warnings_severity_idx').on(table.planId, table.severity),
  })
);

export const securementAssignments = pgTable(
  'securement_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => loadPlans.id, { onDelete: 'cascade' }),
    planItemId: uuid('plan_item_id')
      .notNull()
      .references(() => planItems.id, { onDelete: 'cascade' }),
    type: securementTypeEnum('type').notNull(),
    wll: real('wll').notNull(), // working load limit in lbs
    anchorPointId: varchar('anchor_point_id', { length: 100 }),
    routeDescription: text('route_description'),
    edgeProtectorRequired: boolean('edge_protector_required').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('securement_assignments_plan_id_idx').on(table.planId),
    itemIdx: index('securement_assignments_item_id_idx').on(table.planItemId),
  })
);
