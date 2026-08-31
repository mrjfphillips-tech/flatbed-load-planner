import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const summaries = pgTable(
  'summaries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    aiGenerated: text('ai_generated').notNull(),
    repEdited: text('rep_edited'),
    coverageSnapshot: jsonb('coverage_snapshot').notNull(),
    keyFindings: jsonb('key_findings').notNull(),
    actionItems: jsonb('action_items').notNull(),
    nextSteps: jsonb('next_steps').notNull(),
    frameworkContributions: jsonb('framework_contributions'),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    lastEditedAt: timestamp('last_edited_at', { withTimezone: true }),
  },
  (table) => ({
    sessionIdx: index('summaries_session_id_idx').on(table.sessionId),
  })
);
