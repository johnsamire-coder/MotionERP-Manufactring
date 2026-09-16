import { sql } from 'drizzle-orm';
import { check, pgSchema, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const settingsSchema = pgSchema('settings');

/**
 * One profile per legal company, holding branding info (logo + display name
 * override) used by report headers/footers. `orgNodeId` should reference a
 * node of type 'legal_company', enforced at the service layer (not a DB
 * check, since org_node.nodeType is data, not a fixed enum in the schema).
 */
export const companyProfile = settingsSchema.table('company_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgNodeId: uuid('org_node_id')
    .notNull()
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  displayName: text('display_name'),
  logoUrl: text('logo_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('company_profile_org_node_unique').on(t.orgNodeId),
  check('company_profile_display_name_not_blank', sql`${t.displayName} is null or length(btrim(${t.displayName})) > 0`),
]);

export type CompanyProfile = typeof companyProfile.$inferSelect;
