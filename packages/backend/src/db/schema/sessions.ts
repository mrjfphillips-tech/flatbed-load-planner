import { pgTable, uuid, varchar, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    repId: uuid('rep_id').notNull(),
    dealStage: varchar('deal_stage', { length: 50 }).notNull().default('first_discovery'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    isOfflineRecovery: boolean('is_offline_recovery').default(false).notNull(),
    preCallPlanId: uuid('pre_call_plan_id'),
    experimentAssignmentId: uuid('experiment_assignment_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('sessions_account_id_idx').on(table.accountId),
    repIdx: index('sessions_rep_id_idx').on(table.repId),
    statusIdx: index('sessions_status_idx').on(table.status),
  })
);
