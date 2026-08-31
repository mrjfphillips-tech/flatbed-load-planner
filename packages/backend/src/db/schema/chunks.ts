import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  customType,
} from 'drizzle-orm/pg-core';
import { sourceDocuments } from './source-documents';

// Custom type for pgvector's vector column
const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: unknown): number[] {
    // Parse PostgreSQL vector format: [0.1,0.2,...]
    const str = value as string;
    return str
      .replace(/[\[\]]/g, '')
      .split(',')
      .map(Number);
  },
});

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceDocumentId: uuid('source_document_id')
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    canonicalFields: varchar('canonical_fields', { length: 50 }).array(),
    frameworkNativeFields: varchar('framework_native_fields', { length: 100 }).array(),
    sectionTitle: varchar('section_title', { length: 255 }),
    pageNumber: integer('page_number'),
    embedding: vector('embedding'),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sourceDocIdx: index('chunks_source_document_id_idx').on(table.sourceDocumentId),
    chunkOrderIdx: index('chunks_source_doc_chunk_idx').on(
      table.sourceDocumentId,
      table.chunkIndex
    ),
  })
);
