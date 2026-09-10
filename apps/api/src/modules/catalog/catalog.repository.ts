import { Injectable } from '@nestjs/common';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import {
  item, itemCategory, itemCategoryTranslation, itemTranslation, uom, uomClass, uomTranslation,
} from './catalog.schema';
import type {
  CreateItemCategoryInput, CreateItemInput, CreateUomInput, ItemCategoryRecord, ItemCategoryStatus,
  ItemRecord, ItemStatus, ItemType, Language, UomClassRecord, UomRecord, UomStatus,
} from './catalog.types';

const uomColumns = {
  id: uom.id, code: uom.code, name: uom.name, symbol: uom.symbol,
  classCode: uom.classCode, decimalPrecision: uom.decimalPrecision,
  status: uom.status, createdAt: uom.createdAt, updatedAt: uom.updatedAt,
};
const categoryColumns = {
  id: itemCategory.id, code: itemCategory.code, name: itemCategory.name,
  description: itemCategory.description, parentId: itemCategory.parentId,
  status: itemCategory.status, position: itemCategory.position,
  createdAt: itemCategory.createdAt, updatedAt: itemCategory.updatedAt,
};
const itemColumns = {
  id: item.id, code: item.code, name: item.name, description: item.description,
  itemType: item.itemType, categoryId: item.categoryId, baseUnitId: item.baseUnitId,
  status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt,
};

interface UomRow { id: string; code: string; name: string; symbol: string | null; classCode: string; decimalPrecision: number; status: string; createdAt: Date; updatedAt: Date; }
interface CategoryRow { id: string; code: string; name: string; description: string | null; parentId: string | null; status: string; position: number; createdAt: Date; updatedAt: Date; }
interface ItemRow { id: string; code: string; name: string; description: string | null; itemType: string; categoryId: string; baseUnitId: string; status: string; createdAt: Date; updatedAt: Date; }

function toUomRecord(row: UomRow, name: string): UomRecord {
  return { id: row.id, code: row.code, name, symbol: row.symbol, classCode: row.classCode,
    decimalPrecision: row.decimalPrecision, status: row.status as UomStatus,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function toCategoryRecord(row: CategoryRow, name: string): ItemCategoryRecord {
  return { id: row.id, code: row.code, name, description: row.description, parentId: row.parentId,
    status: row.status as ItemCategoryStatus, position: row.position,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function toItemRecord(row: ItemRow, name: string): ItemRecord {
  return { id: row.id, code: row.code, name, description: row.description,
    itemType: row.itemType as ItemType, categoryId: row.categoryId, baseUnitId: row.baseUnitId,
    status: row.status as ItemStatus, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

@Injectable()
export class CatalogRepository {
  constructor(private readonly database: DatabaseService) {}

  async listUomClasses(): Promise<UomClassRecord[]> {
    return this.database.db.select({ code: uomClass.code, name: uomClass.name, description: uomClass.description })
      .from(uomClass).orderBy(asc(uomClass.code));
  }
  async findUomClass(code: string): Promise<UomClassRecord | null> {
    const rows = await this.database.db.select({ code: uomClass.code, name: uomClass.name, description: uomClass.description })
      .from(uomClass).where(eq(uomClass.code, code)).limit(1);
    return rows[0] ?? null;
  }

  private async uomTranslationMap(language: Language): Promise<Map<string, string>> {
    const rows = await this.database.db.select({ uomId: uomTranslation.uomId, name: uomTranslation.name })
      .from(uomTranslation).where(eq(uomTranslation.language, language));
    return new Map(rows.map((r) => [r.uomId, r.name]));
  }
  async listUoms(language: Language = 'en'): Promise<UomRecord[]> {
    const rows = await this.database.db.select(uomColumns).from(uom).orderBy(asc(uom.code));
    const translations = await this.uomTranslationMap(language);
    return rows.map((r) => toUomRecord(r, translations.get(r.id) ?? r.name));
  }
  async findUomByCode(code: string, language: Language = 'en'): Promise<UomRecord | null> {
    const rows = await this.database.db.select(uomColumns).from(uom).where(eq(uom.code, code)).limit(1);
    if (!rows[0]) return null;
    const translations = await this.uomTranslationMap(language);
    return toUomRecord(rows[0], translations.get(rows[0].id) ?? rows[0].name);
  }
  async findUomById(id: string, language: Language = 'en'): Promise<UomRecord | null> {
    const rows = await this.database.db.select(uomColumns).from(uom).where(eq(uom.id, id)).limit(1);
    if (!rows[0]) return null;
    const translations = await this.uomTranslationMap(language);
    return toUomRecord(rows[0], translations.get(rows[0].id) ?? rows[0].name);
  }
  async insertUom(input: CreateUomInput & { id: string }): Promise<UomRecord> {
    const rows = await this.database.db.insert(uom).values({
      id: input.id, code: input.code, name: input.name, symbol: input.symbol ?? null,
      classCode: input.classCode, decimalPrecision: input.decimalPrecision ?? 2,
    }).returning(uomColumns);
    const inserted = rows[0]!;
    if (input.nameAr) await this.database.db.insert(uomTranslation).values({ uomId: inserted.id, language: 'ar', name: input.nameAr });
    if (input.nameEn) await this.database.db.insert(uomTranslation).values({ uomId: inserted.id, language: 'en', name: input.nameEn });
    return toUomRecord(inserted, inserted.name);
  }

  private async categoryTranslationMap(language: Language): Promise<Map<string, string>> {
    const rows = await this.database.db.select({ categoryId: itemCategoryTranslation.categoryId, name: itemCategoryTranslation.name })
      .from(itemCategoryTranslation).where(eq(itemCategoryTranslation.language, language));
    return new Map(rows.map((r) => [r.categoryId, r.name]));
  }
  async listCategories(language: Language = 'en'): Promise<ItemCategoryRecord[]> {
    const rows = await this.database.db.select(categoryColumns).from(itemCategory)
      .orderBy(asc(itemCategory.position), asc(itemCategory.name));
    const translations = await this.categoryTranslationMap(language);
    return rows.map((r) => toCategoryRecord(r, translations.get(r.id) ?? r.name));
  }
  async findCategoryById(id: string, language: Language = 'en'): Promise<ItemCategoryRecord | null> {
    const rows = await this.database.db.select(categoryColumns).from(itemCategory).where(eq(itemCategory.id, id)).limit(1);
    if (!rows[0]) return null;
    const translations = await this.categoryTranslationMap(language);
    return toCategoryRecord(rows[0], translations.get(rows[0].id) ?? rows[0].name);
  }
  async findCategoryByCode(code: string): Promise<ItemCategoryRecord | null> {
    const rows = await this.database.db.select(categoryColumns).from(itemCategory).where(eq(itemCategory.code, code)).limit(1);
    return rows[0] ? toCategoryRecord(rows[0], rows[0].name) : null;
  }
  async listAncestorIds(categoryId: string): Promise<string[]> {
    const result = await this.database.db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT ${itemCategory.id} AS id, ${itemCategory.parentId} AS parent_id FROM ${itemCategory} WHERE ${itemCategory.id} = ${categoryId}
        UNION ALL
        SELECT c.id, c.parent_id FROM ${itemCategory} c JOIN ancestors a ON c.id = a.parent_id
      ) SELECT id FROM ancestors WHERE id <> ${categoryId}
    `);
    return (result.rows as Array<{ id: string }>).map((row) => row.id);
  }
  async countActiveChildren(categoryId: string): Promise<number> {
    const rows = await this.database.db.select({ count: sql<number>`count(*)::int` }).from(itemCategory)
      .where(and(eq(itemCategory.parentId, categoryId), ne(itemCategory.status, 'archived')));
    return rows[0]?.count ?? 0;
  }
  async insertCategory(input: CreateItemCategoryInput & { id: string }): Promise<ItemCategoryRecord> {
    const rows = await this.database.db.insert(itemCategory).values({
      id: input.id, code: input.code, name: input.name, description: input.description ?? null,
      parentId: input.parentId ?? null, position: input.position ?? 0,
    }).returning(categoryColumns);
    const inserted = rows[0]!;
    if (input.nameAr) await this.database.db.insert(itemCategoryTranslation).values({ categoryId: inserted.id, language: 'ar', name: input.nameAr });
    if (input.nameEn) await this.database.db.insert(itemCategoryTranslation).values({ categoryId: inserted.id, language: 'en', name: input.nameEn });
    return toCategoryRecord(inserted, inserted.name);
  }
  async updateCategoryFields(id: string, fields: { name?: string; description?: string | null; position?: number; parentId?: string | null }): Promise<ItemCategoryRecord> {
    const rows = await this.database.db.update(itemCategory).set(fields).where(eq(itemCategory.id, id)).returning(categoryColumns);
    return toCategoryRecord(rows[0]!, rows[0]!.name);
  }
  async setCategoryStatus(id: string, status: ItemCategoryStatus): Promise<ItemCategoryRecord> {
    const rows = await this.database.db.update(itemCategory).set({ status }).where(eq(itemCategory.id, id)).returning(categoryColumns);
    return toCategoryRecord(rows[0]!, rows[0]!.name);
  }

  private async itemTranslationMap(language: Language): Promise<Map<string, string>> {
    const rows = await this.database.db.select({ itemId: itemTranslation.itemId, name: itemTranslation.name })
      .from(itemTranslation).where(eq(itemTranslation.language, language));
    return new Map(rows.map((r) => [r.itemId, r.name]));
  }
  async listItems(language: Language = 'en'): Promise<ItemRecord[]> {
    const rows = await this.database.db.select(itemColumns).from(item).orderBy(asc(item.code));
    const translations = await this.itemTranslationMap(language);
    return rows.map((r) => toItemRecord(r, translations.get(r.id) ?? r.name));
  }
  async findItemById(id: string, language: Language = 'en'): Promise<ItemRecord | null> {
    const rows = await this.database.db.select(itemColumns).from(item).where(eq(item.id, id)).limit(1);
    if (!rows[0]) return null;
    const translations = await this.itemTranslationMap(language);
    return toItemRecord(rows[0], translations.get(rows[0].id) ?? rows[0].name);
  }
  async findItemByCode(code: string): Promise<ItemRecord | null> {
    const rows = await this.database.db.select(itemColumns).from(item).where(eq(item.code, code)).limit(1);
    return rows[0] ? toItemRecord(rows[0], rows[0].name) : null;
  }
  async insertItem(input: CreateItemInput & { id: string }): Promise<ItemRecord> {
    const rows = await this.database.db.insert(item).values({
      id: input.id, code: input.code, name: input.name, description: input.description ?? null,
      itemType: input.itemType, categoryId: input.categoryId, baseUnitId: input.baseUnitId,
    }).returning(itemColumns);
    const inserted = rows[0]!;
    if (input.nameAr) await this.database.db.insert(itemTranslation).values({ itemId: inserted.id, language: 'ar', name: input.nameAr });
    if (input.nameEn) await this.database.db.insert(itemTranslation).values({ itemId: inserted.id, language: 'en', name: input.nameEn });
    return toItemRecord(inserted, inserted.name);
  }
  async updateItemFields(id: string, fields: { name?: string; description?: string | null; itemType?: ItemType; categoryId?: string; baseUnitId?: string }): Promise<ItemRecord> {
    const rows = await this.database.db.update(item).set(fields).where(eq(item.id, id)).returning(itemColumns);
    return toItemRecord(rows[0]!, rows[0]!.name);
  }
  async setItemStatus(id: string, status: ItemStatus): Promise<ItemRecord> {
    const rows = await this.database.db.update(item).set({ status }).where(eq(item.id, id)).returning(itemColumns);
    return toItemRecord(rows[0]!, rows[0]!.name);
  }
}
