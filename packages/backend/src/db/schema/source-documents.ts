import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { rightsProfiles } from './rights-profiles';

export const sourceDocuments = pgTable(
  'source_documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 500 }).notNull(),
    author: varchar('author', { length: 255 }),
    frameworkAffiliation: varchar('framework_affiliation', { length: 50 }).array(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileUrl: text('file_url').notNull(),
    pageCount: integer('page_count'),
    rightsProfileId: uuid('rights_profile_id')
      .notNull()
      .references(() => rightsProfiles.id),
    ingestionStatus: varchar('ingestion_status', { length: 20 }).default('pending').notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    rightsProfileIdx: index('source_documents_rights_profile_id_idx').on(table.rightsProfileId),
    ingestionStatusIdx: index('source_documents_ingestion_status_idx').on(table.ingestionStatus),
  })
);
