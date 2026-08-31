import { pgTable, uuid, varchar, text, jsonb, integer, real, timestamp, index } from 'drizzle-orm/pg-core';

export const experiments = pgTable(
  'experiments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    controlStrategy: jsonb('control_strategy').notNull(),
    treatmentStrategy: jsonb('treatment_strategy').notNull(),
    targetPopulation: jsonb('target_population').notNull(),
    durationDays: integer('duration_days').notNull(),
    significanceThreshold: real('significance_threshold').default(0.05).notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('experiments_status_idx').on(table.status),
  })
);
