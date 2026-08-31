import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

// ─── Flatbed Load Planner: Users & Roles ──────────────────────────────────────

export const flatbedUserRoleEnum = pgEnum('flatbed_user_role', [
  'Planner',
  'Loader',
  'Driver',
  'Supervisor',
  'Administrator',
  'Customer_Viewer',
]);

export const flatbedUsers = pgTable(
  'flatbed_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 512 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index('flatbed_users_email_idx').on(table.email),
  })
);

export const flatbedUserRoles = pgTable(
  'flatbed_user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => flatbedUsers.id, { onDelete: 'cascade' }),
    role: flatbedUserRoleEnum('role').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('flatbed_user_roles_user_id_idx').on(table.userId),
    uniqueUserRole: index('flatbed_user_roles_unique_idx').on(table.userId, table.role),
  })
);
