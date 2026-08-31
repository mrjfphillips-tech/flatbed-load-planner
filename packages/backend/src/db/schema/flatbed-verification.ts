import {
  pgTable,
  uuid,
  boolean,
  timestamp,
  text,
  json,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { flatbedUsers } from './flatbed-users';
import { planVersions, loadPlans } from './flatbed-load-plans';

// ─── Flatbed Load Planner: Verification Checklists ────────────────────────────

export const verificationChecklists = pgTable(
  'verification_checklists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planVersionId: uuid('plan_version_id')
      .notNull()
      .references(() => planVersions.id, { onDelete: 'cascade' }),
    driverId: uuid('driver_id').references(() => flatbedUsers.id),
    // Checklist items stored as JSON array of check records
    itemPresenceChecks: json('item_presence_checks').$type<
      { itemId: string; verified: boolean; notes?: string }[]
    >(),
    securementChecks: json('securement_checks').$type<
      { securementId: string; verified: boolean; notes?: string }[]
    >(),
    weightCheckVerified: boolean('weight_check_verified').default(false),
    weightCheckNotes: text('weight_check_notes'),
    damageCheckVerified: boolean('damage_check_verified').default(false),
    damageCheckNotes: text('damage_check_notes'),
    allVerified: boolean('all_verified').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    nonConformanceDescription: text('non_conformance_description'),
    supervisorNotified: boolean('supervisor_notified').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planVersionIdx: index('verification_checklists_plan_version_idx').on(table.planVersionId),
    driverIdx: index('verification_checklists_driver_idx').on(table.driverId),
  })
);

// ─── Flatbed Load Planner: Loading Progress ───────────────────────────────────

export const loadingProgress = pgTable(
  'loading_progress',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => loadPlans.id, { onDelete: 'cascade' }),
    totalSteps: integer('total_steps').notNull(),
    completedSteps: integer('completed_steps').notNull().default(0),
    steps: json('steps').$type<
      {
        stepNumber: number;
        description: string;
        completed: boolean;
        completedBy?: string;
        completedAt?: string;
      }[]
    >(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('loading_progress_plan_id_idx').on(table.planId),
  })
);
