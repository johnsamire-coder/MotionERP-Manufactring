import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CatalogNotFoundError, CatalogValidationError } from './catalog.errors';
import { CatalogRepository } from './catalog.repository';
import type {
  CreateItemCategoryInput, CreateItemInput, CreateUomInput, ItemCategoryRecord,
  ItemCategoryTreeNode, ItemRecord, ItemType, Language, UomClassRecord, UomRecord,
} from './catalog.types';

export interface UpdateItemCategoryInput { name?: string; description?: string | null; position?: number; parentId?: string | null; }
export interface UpdateItemInput { name?: string; description?: string | null; itemType?: ItemType; categoryId?: string; baseUnitId?: string; }

function buildCategoryForest(rows: ItemCategoryRecord[]): ItemCategoryTreeNode[] {
  const byId = new Map<string, ItemCategoryTreeNode>();
  for (const row of rows) byId.set(row.id, { ...row, children: [] });
  const roots: ItemCategoryTreeNode[] = [];
  for (const row of rows) {
    const node = byId.get(row.id)!;
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    if (parent) parent.children.push(node); else roots.push(node);
  }
  const byOrder = (a: ItemCategoryTreeNode, b: ItemCategoryTreeNode): number =>
    a.position - b.position || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  function sortRecursively(nodes: ItemCategoryTreeNode[]): void {
    nodes.sort(byOrder);
    for (const node of nodes) sortRecursively(node.children);
  }
  sortRecursively(roots);
  return roots;
}

@Injectable()
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async getUomClasses(): Promise<UomClassRecord[]> { return this.repository.listUomClasses(); }
  async getUoms(language: Language = 'en'): Promise<UomRecord[]> { return this.repository.listUoms(language); }
  async getUomByCode(code: string, language: Language = 'en'): Promise<UomRecord> {
    const found = await this.repository.findUomByCode(code, language);
    if (!found) throw new CatalogNotFoundError(`UOM ${code} does not exist`);
    return found;
  }
  async createUom(input: CreateUomInput): Promise<UomRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const foundClass = await this.repository.findUomClass(input.classCode);
    if (!foundClass) throw new CatalogValidationError(`unknown UOM class: "${input.classCode}"`);
    const existing = await this.repository.findUomByCode(code);
    if (existing) throw new CatalogValidationError(`a UOM with code "${code}" already exists`);
    return this.repository.insertUom({
      id: randomUUID(), code, name, nameAr: input.nameAr, nameEn: input.nameEn,
      symbol: input.symbol, classCode: foundClass.code, decimalPrecision: input.decimalPrecision,
    });
  }

  async getCategoryTree(language: Language = 'en'): Promise<ItemCategoryTreeNode[]> {
    const all = await this.repository.listCategories(language);
    return buildCategoryForest(all);
  }
  async getCategory(id: string, language: Language = 'en'): Promise<ItemCategoryRecord> {
    const found = await this.repository.findCategoryById(id, language);
    if (!found) throw new CatalogNotFoundError(`item category ${id} does not exist`);
    return found;
  }
  async createCategory(input: CreateItemCategoryInput): Promise<ItemCategoryRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const position = normalizePosition(input.position ?? 0);
    const existing = await this.repository.findCategoryByCode(code);
    if (existing) throw new CatalogValidationError(`an item category with code "${code}" already exists`);
    if (input.parentId) {
      const parent = await this.repository.findCategoryById(input.parentId);
      if (!parent) throw new CatalogNotFoundError(`parent category ${input.parentId} does not exist`);
      if (parent.status === 'archived') throw new CatalogValidationError(`parent category ${input.parentId} is archived and cannot take children`);
    }
    return this.repository.insertCategory({
      id: randomUUID(), code, name, nameAr: input.nameAr, nameEn: input.nameEn,
      description: input.description, parentId: input.parentId ?? null, position,
    });
  }
  async updateCategory(id: string, patch: UpdateItemCategoryInput): Promise<ItemCategoryRecord> {
    const category = await this.repository.findCategoryById(id);
    if (!category) throw new CatalogNotFoundError(`item category ${id} does not exist`);
    if (category.status === 'archived') throw new CatalogValidationError(`item category ${id} is archived and cannot be modified`);
    const fields: { name?: string; description?: string | null; position?: number; parentId?: string | null } = {};
    if (patch.name !== undefined) fields.name = normalizeName(patch.name);
    if (patch.description !== undefined) fields.description = patch.description;
    if (patch.position !== undefined) fields.position = normalizePosition(patch.position);
    if ('parentId' in patch) {
      const newParentId = patch.parentId ?? null;
      await this.assertMoveAllowed(category, newParentId);
      fields.parentId = newParentId;
    }
    if (Object.keys(fields).length === 0) return category;
    return this.repository.updateCategoryFields(id, fields);
  }
  async archiveCategory(id: string): Promise<ItemCategoryRecord> {
    const category = await this.repository.findCategoryById(id);
    if (!category) throw new CatalogNotFoundError(`item category ${id} does not exist`);
    if (category.status === 'archived') return category;
    const activeChildren = await this.repository.countActiveChildren(id);
    if (activeChildren > 0) throw new CatalogValidationError(`item category ${id} still has ${activeChildren} non-archived child categor(y/ies); archive the children first`);
    return this.repository.setCategoryStatus(id, 'archived');
  }
  private async assertMoveAllowed(category: ItemCategoryRecord, newParentId: string | null): Promise<void> {
    if (newParentId === category.id) throw new CatalogValidationError('a category cannot be its own parent');
    if (newParentId === null) return;
    const parent = await this.repository.findCategoryById(newParentId);
    if (!parent) throw new CatalogNotFoundError(`parent category ${newParentId} does not exist`);
    if (parent.status === 'archived') throw new CatalogValidationError(`parent category ${newParentId} is archived and cannot take children`);
    const ancestorIds = await this.repository.listAncestorIds(newParentId);
    if (ancestorIds.includes(category.id)) throw new CatalogValidationError(`moving category ${category.id} under ${newParentId} would create a cycle`);
  }

  async getItems(language: Language = 'en'): Promise<ItemRecord[]> { return this.repository.listItems(language); }
  async getItem(id: string, language: Language = 'en'): Promise<ItemRecord> {
    const found = await this.repository.findItemById(id, language);
    if (!found) throw new CatalogNotFoundError(`item ${id} does not exist`);
    return found;
  }
  async createItem(input: CreateItemInput): Promise<ItemRecord> {
    const code = normalizeCode(input.code);
    const name = normalizeName(input.name);
    const existing = await this.repository.findItemByCode(code);
    if (existing) throw new CatalogValidationError(`an item with code "${code}" already exists`);
    const category = await this.repository.findCategoryById(input.categoryId);
    if (!category) throw new CatalogNotFoundError(`item category ${input.categoryId} does not exist`);
    if (category.status === 'archived') throw new CatalogValidationError(`item category ${input.categoryId} is archived and cannot take new items`);
    const baseUnit = await this.repository.findUomById(input.baseUnitId);
    if (!baseUnit) throw new CatalogNotFoundError(`UOM ${input.baseUnitId} does not exist`);
    return this.repository.insertItem({
      id: randomUUID(), code, name, nameAr: input.nameAr, nameEn: input.nameEn,
      description: input.description, itemType: input.itemType, categoryId: category.id, baseUnitId: baseUnit.id,
    });
  }
  async updateItem(id: string, patch: UpdateItemInput): Promise<ItemRecord> {
    const found = await this.repository.findItemById(id);
    if (!found) throw new CatalogNotFoundError(`item ${id} does not exist`);
    if (found.status === 'archived') throw new CatalogValidationError(`item ${id} is archived and cannot be modified`);
    const fields: { name?: string; description?: string | null; itemType?: ItemType; categoryId?: string; baseUnitId?: string } = {};
    if (patch.name !== undefined) fields.name = normalizeName(patch.name);
    if (patch.description !== undefined) fields.description = patch.description;
    if (patch.itemType !== undefined) fields.itemType = patch.itemType;
    if (patch.categoryId !== undefined) {
      const category = await this.repository.findCategoryById(patch.categoryId);
      if (!category) throw new CatalogNotFoundError(`item category ${patch.categoryId} does not exist`);
      fields.categoryId = category.id;
    }
    if (patch.baseUnitId !== undefined) {
      const baseUnit = await this.repository.findUomById(patch.baseUnitId);
      if (!baseUnit) throw new CatalogNotFoundError(`UOM ${patch.baseUnitId} does not exist`);
      fields.baseUnitId = baseUnit.id;
    }
    if (Object.keys(fields).length === 0) return found;
    return this.repository.updateItemFields(id, fields);
  }
  async archiveItem(id: string): Promise<ItemRecord> {
    const found = await this.repository.findItemById(id);
    if (!found) throw new CatalogNotFoundError(`item ${id} does not exist`);
    if (found.status === 'archived') return found;
    return this.repository.setItemStatus(id, 'archived');
  }
}

function normalizeCode(raw: unknown): string {
  if (typeof raw !== 'string') throw new CatalogValidationError('code is required');
  const trimmed = raw.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(trimmed)) throw new CatalogValidationError('code must match ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$');
  return trimmed;
}
function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new CatalogValidationError('name is required');
  const trimmed = raw.trim();
  if (trimmed.length === 0) throw new CatalogValidationError('name must not be blank');
  return trimmed;
}
function normalizePosition(raw: number): number {
  if (!Number.isInteger(raw) || raw < 0) throw new CatalogValidationError('position must be a non-negative integer');
  return raw;
}
