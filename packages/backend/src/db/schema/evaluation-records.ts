import { pgTable, uuid, varchar, real, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const evaluationRecords = pgTable(
  'evaluation_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    responseId: varchar('response_id', { length: 255 }).notNull(),
    factuality: real('factuality').notNull(),
    groundedness: real('groundedness').notNull(),
    citationQuality: real('citation_quality').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    tokenCost: integer('token_cost').notNull(),
    passesThreshold: boolean('passes_threshold').notNull(),
    issues: jsonb('issues').default([]).notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('evaluation_records_session_id_idx').on(table.sessionId),
    evaluatedAtIdx: index('evaluation_records_evaluated_at_idx').on(table.evaluatedAt),
  })
);
