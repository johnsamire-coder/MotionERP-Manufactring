import { sql } from 'drizzle-orm';
import {
  check, index, integer, numeric, pgSchema, primaryKey, text, timestamp, uuid, unique,
} from 'drizzle-orm/pg-core';

export const catalogSchema = pgSchema('catalog');

export const uomClass = catalogSchema.table('uom_class', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
});

export const uom = catalogSchema.table('uom', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  symbol: text('symbol'),
  classCode: text('class_code')
    .notNull()
    .references(() => uomClass.code, { onUpdate: 'cascade', onDelete: 'restrict' }),
  decimalPrecision: integer('decimal_precision').notNull().default(2),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('uom_code_unique').on(t.code),
  check('uom_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('uom_name_not_blank', sql`length(btrim(${t.name})) > 0`),
  check('uom_precision_range', sql`${t.decimalPrecision} >= 0 and ${t.decimalPrecision} <= 6`),
  check('uom_status_valid', sql`${t.status} in ('active', 'inactive', 'archived')`),
  index('uom_class_idx').on(t.classCode),
]);

export const uomTranslation = catalogSchema.table('uom_translation', {
  uomId: uuid('uom_id')
    .notNull()
    .references(() => uom.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  language: text('language').notNull(),
  name: text('name').notNull(),
}, (t) => [
  primaryKey({ name: 'uom_translation_pk', columns: [t.uomId, t.language] }),
  check('uom_translation_language_valid', sql`${t.language} in ('ar', 'en')`),
  check('uom_translation_name_not_blank', sql`length(btrim(${t.name})) > 0`),
]);

export const itemCategory = catalogSchema.table('item_category', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  parentId: uuid('parent_id'),
  status: text('status').notNull().default('active'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('item_category_code_unique').on(t.code),
  check('item_category_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('item_category_name_not_blank', sql`length(btrim(${t.name})) > 0`),
  check('item_category_status_valid', sql`${t.status} in ('active', 'inactive', 'archived')`),
]);

export const itemCategoryTranslation = catalogSchema.table('item_category_translation', {
  categoryId: uuid('category_id')
    .notNull()
    .references(() => itemCategory.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  language: text('language').notNull(),
  name: text('name').notNull(),
  description: text('description'),
}, (t) => [
  primaryKey({ name: 'item_category_translation_pk', columns: [t.categoryId, t.language] }),
  check('item_category_translation_language_valid', sql`${t.language} in ('ar', 'en')`),
  check('item_category_translation_name_not_blank', sql`length(btrim(${t.name})) > 0`),
]);

export const item = catalogSchema.table('item', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  itemType: text('item_type').notNull(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => itemCategory.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  baseUnitId: uuid('base_unit_id')
    .notNull()
    .references(() => uom.id, { onUpdate: 'cascade', onDelete: 'restrict' }),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('item_code_unique').on(t.code),
  check('item_code_format', sql`${t.code} ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'`),
  check('item_name_not_blank', sql`length(btrim(${t.name})) > 0`),
  check(
    'item_type_valid',
    sql`${t.itemType} in ('raw_material', 'finished_product', 'semi_finished_product', 'consumable', 'spare_part', 'service')`,
  ),
  check('item_status_valid', sql`${t.status} in ('active', 'inactive', 'archived')`),
  index('item_category_idx').on(t.categoryId),
  index('item_base_unit_idx').on(t.baseUnitId),
]);

export const itemTranslation = catalogSchema.table('item_translation', {
  itemId: uuid('item_id')
    .notNull()
    .references(() => item.id, { onUpdate: 'cascade', onDelete: 'cascade' }),
  language: text('language').notNull(),
  name: text('name').notNull(),
  description: text('description'),
}, (t) => [
  primaryKey({ name: 'item_translation_pk', columns: [t.itemId, t.language] }),
  check('item_translation_language_valid', sql`${t.language} in ('ar', 'en')`),
  check('item_translation_name_not_blank', sql`length(btrim(${t.name})) > 0`),
]);

export type UomClass = typeof uomClass.$inferSelect;
export type Uom = typeof uom.$inferSelect;
export type ItemCategory = typeof itemCategory.$inferSelect;
export type Item = typeof item.$inferSelect;
