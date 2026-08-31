import { pgTable, uuid, varchar, text, real, timestamp, index } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const objectionEvents = pgTable(
  'objection_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    objectionType: varchar('objection_type', { length: 50 }).notNull(),
    triggerText: text('trigger_text').notNull(),
    responseStrategy: text('response_strategy'),
    frameworkAttribution: varchar('framework_attribution', { length: 50 }),
    effectivenessScore: real('effectiveness_score'),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('objection_events_session_id_idx').on(table.sessionId),
    typeIdx: index('objection_events_type_idx').on(table.objectionType),
  })
);
