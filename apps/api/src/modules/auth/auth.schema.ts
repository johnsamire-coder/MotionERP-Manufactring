import { sql } from 'drizzle-orm';
import { check, index, numeric, pgSchema, text, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { orgNode } from '../organization/organization.schema';

export const authSchema = pgSchema('auth');

export const role = authSchema.table('role', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('role_code_unique').on(t.code),
  check('role_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('role_name_not_blank', sql`length(btrim(${t.name})) > 0`),
  check('role_status_valid', sql`${t.status} in ('active', 'inactive')`),
]);

/**
 * Permission = action + resource + scope (org node) + optional value limit,
 * exactly as documented in the architecture decisions since day one — this
 * is the first phase that actually activates that long-standing design.
 */
export const permission = authSchema.table('permission', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id')
    .notNull()
    .references(() => role.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  action: text('action').notNull(), // 'create' | 'read' | 'update' | 'delete' | 'approve'
  resource: text('resource').notNull(), // e.g. 'sales.quotation', 'production.material_request'
  scopeOrgNodeId: uuid('scope_org_node_id')
    .references(() => orgNode.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  valueLimit: numeric('value_limit', { precision: 14, scale: 4 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('permission_action_valid', sql`${t.action} in ('create', 'read', 'update', 'delete', 'approve')`),
  check('permission_resource_not_blank', sql`length(btrim(${t.resource})) > 0`),
  check('permission_value_limit_positive', sql`${t.valueLimit} is null or ${t.valueLimit} > 0`),
  index('permission_role_idx').on(t.roleId),
  index('permission_resource_idx').on(t.resource),
]);

export const user = authSchema.table('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  roleId: uuid('role_id')
    .notNull()
    .references(() => role.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  employeeReference: text('employee_reference'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('user_username_unique').on(t.username),
  check('user_username_format', sql`${t.username} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$'`),
  check('user_status_valid', sql`${t.status} in ('active', 'inactive', 'locked')`),
  index('user_role_idx').on(t.roleId),
]);

/**
 * User Permission (plan item 5.1): restricts ONE user to specific values of a dimension.
 * No rows for a dimension = the user is unrestricted on it; rows = only those values
 * (an org node also covers everything under it in the tree). allow_value points into
 * another module (org node / inventory warehouse), so it is a plain UUID checked in the
 * service, not a foreign key (D2/D20).
 */
export const userPermission = authSchema.table('user_permission', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  allowType: text('allow_type').notNull(),
  allowValue: uuid('allow_value').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('user_permission_unique').on(t.userId, t.allowType, t.allowValue),
  check('user_permission_allow_type_valid', sql`${t.allowType} in ('org_node', 'warehouse')`),
  index('user_permission_user_idx').on(t.userId),
]);

export type Role = typeof role.$inferSelect;
export type Permission = typeof permission.$inferSelect;
export type User = typeof user.$inferSelect;
