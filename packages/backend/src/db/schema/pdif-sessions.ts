import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';

/**
 * PDIF Sessions — A live discovery coaching session tied to an account.
 * Tracks the 5-phase PDIF framework, session state, and metadata.
 */
export const pdifSessions = pgTable(
  'pdif_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    repId: uuid('rep_id').notNull(),

    // PDIF Phase tracking
    currentPhase: varchar('current_phase', { length: 20 }).notNull().default('discover'),
    // 'discover' | 'diagnose' | 'design' | 'demonstrate' | 'deliver'

    // Session lifecycle
    status: varchar('status', { length: 20 }).notNull().default('active'),
    // 'preparing' | 'active' | 'paused' | 'ended'

    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),

    // Session metadata
    sessionNumber: integer('session_number').default(1).notNull(), // Which session for this account
    attendees: jsonb('attendees').default('[]').notNull(), // Contact IDs + roles
    objectives: jsonb('objectives').default('[]').notNull(), // Pre-session goals

    // Post-session outputs
    summary: text('summary'),
    actionItems: jsonb('action_items').default('[]').notNull(),
    followUpEmail: text('follow_up_email'),
    crmExported: boolean('crm_exported').default(false).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('pdif_sessions_account_id_idx').on(table.accountId),
    repIdx: index('pdif_sessions_rep_id_idx').on(table.repId),
    statusIdx: index('pdif_sessions_status_idx').on(table.status),
  })
);
