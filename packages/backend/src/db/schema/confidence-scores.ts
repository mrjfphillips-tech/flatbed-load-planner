import { pgTable, uuid, varchar, real, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { pdifSessions } from './pdif-sessions';

/**
 * Confidence Scores — How well does the rep understand the customer's business?
 *
 * V1 tracks 5 categories. Each category shows a percentage (0-100)
 * that only increases when actual evidence is captured — not just when
 * a question is asked.
 *
 * V1 Categories:
 *   1. company_operations   — Do we understand how their business runs?
 *   2. fleet_network        — Do we understand their vehicles, routes, geography?
 *   3. technology_data      — Do we understand their current systems?
 *   4. financial_drivers    — Do we understand their costs and budget?
 *   5. buying_process       — Do we understand who decides and how?
 */
export const confidenceScores = pgTable(
  'confidence_scores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => pdifSessions.id),

    // Which of the 5 V1 categories?
    category: varchar('category', { length: 50 }).notNull(),
    // 'company_operations' | 'fleet_network' | 'technology_data' |
    // 'financial_drivers' | 'buying_process'

    // Current confidence score (0-100)
    score: real('score').default(0).notNull(),

    // What specific evidence contributed to this score?
    supportingEvidence: jsonb('supporting_evidence').default('[]').notNull(),
    // Array of: { text: "...", source: "transcript", sessionId: "...", weight: 0.8 }

    // What is still unknown in this category?
    gaps: jsonb('gaps').default('[]').notNull(),
    // Array of: { description: "Fleet utilization rate unknown", priority: "high" }

    // The top 2 questions that would most increase this score
    recommendedQuestions: jsonb('recommended_questions').default('[]').notNull(),

    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('confidence_scores_account_id_idx').on(table.accountId),
    sessionIdx: index('confidence_scores_session_id_idx').on(table.sessionId),
    categoryIdx: index('confidence_scores_category_idx').on(table.category),
    // Ensure one score per category per session
  })
);
