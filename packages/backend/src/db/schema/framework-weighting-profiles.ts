import { pgTable, uuid, varchar, jsonb, timestamp, index, unique } from 'drizzle-orm/pg-core';

export const frameworkWeightingProfiles = pgTable(
  'framework_weighting_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dealStage: varchar('deal_stage', { length: 50 }).notNull(),
    weights: jsonb('weights').notNull(),
    organizationId: uuid('organization_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dealStageIdx: index('framework_weighting_profiles_deal_stage_idx').on(table.dealStage),
    orgDealStageUnique: unique('framework_weighting_profiles_org_stage_unique').on(
      table.organizationId,
      table.dealStage
    ),
  })
);
