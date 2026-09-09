import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Organizational core — Architecture Decisions D10.
 *
 * ONE generic node table represents every level of every company/group structure
 * (group, legal company, activity, branch, region, site, factory, department,
 * section, operating unit, warehouse, work center, project, ...). New node types
 * are added as ROWS in `org_node_type`, never as new tables or DDL changes.
 *
 * Lives in the `platform` schema because the org tree spans the whole group and
 * is the anchor that future per-company operational tables point at — it does
 * not itself belong to a single company (D8 / D9).
 */
export const platformSchema = pgSchema('platform');

/** Extensible vocabulary of node types (config, not code). */
export const orgNodeType = platformSchema.table('org_node_type', {
  code: text('code').primaryKey(),
  label: text('label').notNull(),
  /** Whether a node of this type is allowed to sit at the root (no parent). */
  canBeRoot: boolean('can_be_root').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Allowed parent/child type pairs (D10: "each node type has clear rules about
 * who may be its parent"). A row (child_type = X, parent_type = Y) means a node
 * of type X may have a parent of type Y. Extensible as data — adding or removing
 * a rule never touches the `org_node` table structure.
 */
export const orgNodeParentRule = platformSchema.table(
  'org_node_parent_rule',
  {
    childType: text('child_type')
      .notNull()
      .references(() => orgNodeType.code, { onUpdate: 'cascade', onDelete: 'cascade' }),
    parentType: text('parent_type')
      .notNull()
      .references(() => orgNodeType.code, { onUpdate: 'cascade', onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'org_node_parent_rule_pk', columns: [t.childType, t.parentType] })],
);

export const orgNode = platformSchema.table(
  'org_node',
  {
    /** Stable internal id. UUID so nodes can be created offline without collisions (D14). */
    id: uuid('id').primaryKey().defaultRandom(),
    /** The kind of node. FK to the type vocabulary. */
    nodeType: text('node_type')
      .notNull()
      .references(() => orgNodeType.code, { onUpdate: 'cascade', onDelete: 'restrict' }),
    /** Fallback display name. Translations are added in a later phase as a side table (D16). */
    name: text('name').notNull(),
    /** Parent node, null for a root. */
    parentId: uuid('parent_id'),
    /** Lifecycle state. Removal = 'archived', never a hard delete (D25). */
    status: text('status').notNull().default('active'),
    /** Ordering among siblings. */
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** Who created/updated the row. No FK yet — the users table does not exist. */
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
  },
  (t) => [
    foreignKey({
      name: 'org_node_parent_id_fk',
      columns: [t.parentId],
      foreignColumns: [t.id],
    }).onDelete('restrict'),
    // Serves both "children of node X ordered by position" and "root nodes" (parent_id IS NULL).
    index('org_node_parent_position_idx').on(t.parentId, t.position),
    // Serves the type FK and "list all nodes of type X" (e.g. every legal company).
    index('org_node_node_type_idx').on(t.nodeType),
    check('org_node_no_self_parent', sql`${t.parentId} is null or ${t.parentId} <> ${t.id}`),
    check('org_node_status_valid', sql`${t.status} in ('active', 'inactive', 'archived')`),
    check('org_node_name_not_blank', sql`length(btrim(${t.name})) > 0`),
  ],
);
