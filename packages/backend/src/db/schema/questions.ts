import { pgTable, uuid, varchar, text, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core';

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    text: text('text').notNull(),
    framework: varchar('framework', { length: 50 }).notNull(),
    canonicalField: varchar('canonical_field', { length: 50 }),
    frameworkNativeField: varchar('framework_native_field', { length: 100 }),
    buyerPersona: varchar('buyer_persona', { length: 100 }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    frameworkIdx: index('questions_framework_idx').on(table.framework),
    canonicalFieldIdx: index('questions_canonical_field_idx').on(table.canonicalField),
    activeIdx: index('questions_is_active_idx').on(table.isActive),
  })
);

export const preferredQuestions = pgTable(
  'preferred_questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    repId: uuid('rep_id').notNull(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    framework: varchar('framework', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    repQuestionUnique: unique('preferred_questions_rep_question_unique').on(
      table.repId,
      table.questionId
    ),
    repIdx: index('preferred_questions_rep_id_idx').on(table.repId),
  })
);
