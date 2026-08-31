import { pgTable, uuid, varchar, text, timestamp, index, unique } from 'drizzle-orm/pg-core';

export const crosswalkMappings = pgTable(
  'crosswalk_mappings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    framework: varchar('framework', { length: 50 }).notNull(),
    nativeField: varchar('native_field', { length: 100 }).notNull(),
    canonicalField: varchar('canonical_field', { length: 50 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    frameworkIdx: index('crosswalk_mappings_framework_idx').on(table.framework),
    canonicalFieldIdx: index('crosswalk_mappings_canonical_field_idx').on(table.canonicalField),
    frameworkNativeUnique: unique('crosswalk_mappings_framework_native_unique').on(
      table.framework,
      table.nativeField
    ),
  })
);
