import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  text,
  json,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { flatbedUsers } from './flatbed-users';

// ─── Flatbed Load Planner: Rules & Audit Log ──────────────────────────────────

export const ruleTypeEnum = pgEnum('rule_type', [
  'hard_constraint',
  'soft_preference',
  'advisory',
]);

export const flatbedRules = pgTable(
  'flatbed_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: ruleTypeEnum('type').notNull(),
    conditions: json('conditions').$type<Record<string, unknown>>(),
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    createdBy: uuid('created_by').references(() => flatbedUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index('flatbed_rules_type_idx').on(table.type),
    activeIdx: index('flatbed_rules_active_idx').on(table.isActive),
  })
);

export const ruleAuditLog = pgTable(
  'rule_audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => flatbedRules.id, { onDelete: 'cascade' }),
    changedBy: uuid('changed_by')
      .notNull()
      .references(() => flatbedUsers.id),
    previousType: ruleTypeEnum('previous_type').notNull(),
    newType: ruleTypeEnum('new_type').notNull(),
    changeDescription: text('change_description'),
    changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ruleIdx: index('rule_audit_log_rule_id_idx').on(table.ruleId),
    changedByIdx: index('rule_audit_log_changed_by_idx').on(table.changedBy),
    changedAtIdx: index('rule_audit_log_changed_at_idx').on(table.changedAt),
  })
);
