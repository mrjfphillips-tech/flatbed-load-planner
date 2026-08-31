import { pgTable, uuid, varchar, real, timestamp, index } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const coverageSnapshots = pgTable(
  'coverage_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    fieldType: varchar('field_type', { length: 20 }).notNull(), // 'canonical' | 'framework_native'
    fieldName: varchar('field_name', { length: 100 }).notNull(),
    framework: varchar('framework', { length: 50 }),
    score: real('score').notNull(), // 0-100
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('coverage_snapshots_session_id_idx').on(table.sessionId),
    fieldTypeIdx: index('coverage_snapshots_field_type_idx').on(table.fieldType),
    fieldNameIdx: index('coverage_snapshots_field_name_idx').on(table.fieldName),
  })
);
