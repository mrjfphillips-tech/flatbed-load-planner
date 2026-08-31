import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';

export const preCallPlans = pgTable(
  'pre_call_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    repId: uuid('rep_id').notNull(),
    attendees: jsonb('attendees').notNull(),
    dealStage: varchar('deal_stage', { length: 50 }).notNull(),
    topics: jsonb('topics'),
    notes: text('notes'),
    generatedPlan: jsonb('generated_plan'),
    repModifiedPlan: jsonb('rep_modified_plan'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('pre_call_plans_account_id_idx').on(table.accountId),
    repIdx: index('pre_call_plans_rep_id_idx').on(table.repId),
  })
);
