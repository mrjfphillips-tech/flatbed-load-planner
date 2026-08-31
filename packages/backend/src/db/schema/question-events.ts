import { pgTable, uuid, varchar, real, timestamp, index } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';
import { questions } from './questions';

export const questionEvents = pgTable(
  'question_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    eventType: varchar('event_type', { length: 20 }).notNull(), // 'suggested' | 'accepted' | 'skipped' | 'dismissed'
    framework: varchar('framework', { length: 50 }).notNull(),
    intentScore: real('intent_score'),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('question_events_session_id_idx').on(table.sessionId),
    questionIdx: index('question_events_question_id_idx').on(table.questionId),
    frameworkIdx: index('question_events_framework_idx').on(table.framework),
  })
);
