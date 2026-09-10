export type UomStatus = 'active' | 'inactive' | 'archived';
export type ItemCategoryStatus = 'active' | 'inactive' | 'archived';
export type ItemStatus = 'active' | 'inactive' | 'archived';
export type Language = 'ar' | 'en';
export type ItemType =
  | 'raw_material' | 'finished_product' | 'semi_finished_product'
  | 'consumable' | 'spare_part' | 'service';

export interface UomClassRecord { code: string; name: string; description: string | null; }

export interface UomRecord {
  id: string; code: string; name: string; symbol: string | null;
  classCode: string; decimalPrecision: number; status: UomStatus;
  createdAt: string; updatedAt: string;
}
export interface CreateUomInput {
  code: string; name: string; nameAr?: string; nameEn?: string;
  symbol?: string; classCode: string; decimalPrecision?: number;
}

export interface ItemCategoryRecord {
  id: string; code: string; name: string; description: string | null;
  parentId: string | null; status: ItemCategoryStatus; position: number;
  createdAt: string; updatedAt: string;
}
export interface CreateItemCategoryInput {
  code: string; name: string; nameAr?: string; nameEn?: string;
  description?: string; parentId?: string | null; position?: number;
}
export interface ItemCategoryTreeNode extends ItemCategoryRecord { children: ItemCategoryTreeNode[]; }

export interface ItemRecord {
  id: string; code: string; name: string; description: string | null;
  itemType: ItemType; categoryId: string; baseUnitId: string; status: ItemStatus;
  createdAt: string; updatedAt: string;
}
export interface CreateItemInput {
  code: string; name: string; nameAr?: string; nameEn?: string; description?: string;
  itemType: ItemType; categoryId: string; baseUnitId: string;
}
