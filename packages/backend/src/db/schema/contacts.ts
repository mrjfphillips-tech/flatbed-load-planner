import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    jobTitle: varchar('job_title', { length: 255 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    address: text('address'),
    linkedInUrl: varchar('linkedin_url', { length: 500 }),
    buyerPersona: varchar('buyer_persona', { length: 100 }),
    businessCardImageUrl: text('business_card_image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index('contacts_account_id_idx').on(table.accountId),
    emailIdx: index('contacts_email_idx').on(table.email),
  })
);
