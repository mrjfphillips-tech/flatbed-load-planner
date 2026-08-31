import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const rightsProfiles = pgTable('rights_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  licensingType: varchar('licensing_type', { length: 50 }).notNull(),
  permittedRoles: varchar('permitted_roles', { length: 20 }).array().notNull(),
  permittedTeams: uuid('permitted_teams').array(),
  attributionText: text('attribution_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
