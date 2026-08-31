import { pgTable, uuid, date, jsonb, real, timestamp, index } from 'drizzle-orm/pg-core';

export const repPerformanceMetrics = pgTable(
  'rep_performance_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    repId: uuid('rep_id').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    frameworkUsage: jsonb('framework_usage'),
    avgIntentScores: jsonb('avg_intent_scores'),
    coverageVelocityMinutes: real('coverage_velocity_minutes'),
    talkTimeRatio: real('talk_time_ratio'),
    questionAcceptanceRate: real('question_acceptance_rate'),
    objectionHandlingScore: real('objection_handling_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repIdx: index('rep_performance_metrics_rep_id_idx').on(table.repId),
    periodIdx: index('rep_performance_metrics_period_idx').on(
      table.periodStart,
      table.periodEnd
    ),
  })
);
