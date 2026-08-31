import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sessions } from './sessions';

export const exportEvents = pgTable(
  'export_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    platform: varchar('platform', { length: 50 }).notNull(),
    exportType: varchar('export_type', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    externalId: varchar('external_id', { length: 255 }),
    error: text('error'),
    payload: jsonb('payload'),
    retryCount: varchar('retry_count', { length: 10 }).default('0'),
    retryable: boolean('retryable').default(true),
    exportedAt: timestamp('exported_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdx: index('export_events_session_id_idx').on(table.sessionId),
    platformIdx: index('export_events_platform_idx').on(table.platform),
    statusIdx: index('export_events_status_idx').on(table.status),
  })
);
