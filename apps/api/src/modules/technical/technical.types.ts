export type DocumentType = 'shop_drawing' | 'cutting_list' | 'other';
export type BomStatus = 'draft' | 'approved' | 'archived';
export type ConsumeComponentsBasedOn = 'bom' | 'material_transferred_for_manufacture';
export interface TechnicalDocumentRecord {
  id: string;
  jobOrderReference: string;
  orgNodeId: string | null;
  documentType: DocumentType;
  fileReference: string;
  version: number;
  note: string | null;
  createdAt: string;
}
export interface CreateTechnicalDocumentInput {
  jobOrderReference: string;
  documentType: DocumentType;
  fileReference: string;
  note?: string;
}
export interface BomLineRecord {
  id: string;
  bomId: string;
  componentItemId: string;
  quantity: string;
  lineNumber: number;
  operationId: string | null;
  standardTimeMinutes: string | null;
}
export interface BomRecord {
  id: string;
  productItemId: string;
  orgNodeId: string;
  version: number;
  outputQuantity: string;
  isActive: boolean;
  isDefault: boolean;
  isPhantomBom: boolean;
  allowAlternativeItem: boolean;
  qualityInspectionRequired: boolean;
  consumeComponentsBasedOn: ConsumeComponentsBasedOn;
  defaultSourceWarehouseId: string | null;
  defaultTargetWarehouseId: string | null;
  status: BomStatus;
  lines: BomLineRecord[];
}
export interface CreateBomLineInput {
  componentItemId: string;
  quantity: string;
  operationId?: string;
  standardTimeMinutes?: string;
}
export interface CreateBomInput {
  productItemId: string;
  orgNodeId: string;
  outputQuantity?: string;
  isActive?: boolean;
  isDefault?: boolean;
  isPhantomBom?: boolean;
  allowAlternativeItem?: boolean;
  qualityInspectionRequired?: boolean;
  consumeComponentsBasedOn?: ConsumeComponentsBasedOn;
  defaultSourceWarehouseId?: string;
  defaultTargetWarehouseId?: string;
  lines: CreateBomLineInput[];
}

export interface BomCreatorItemRecord {
  id: string;
  bomCreatorId: string;
  parentId: string | null;
  componentItemId: string;
  quantity: string;
  isSubAssembly: boolean;
  generatedBomId: string | null;
  lineNumber: number;
}
export interface BomCreatorItemInput {
  tempId: number;
  parentTempId?: number;
  componentItemId: string;
  quantity: string;
  isSubAssembly?: boolean;
}

export interface BomCreatorRecord {
  id: string;
  creatorNumber: string;
  productItemId: string;
  orgNodeId: string;
  quantityToProduce: string;
  allowAlternativeItem: boolean;
  remarks: string | null;
  status: 'draft' | 'completed';
  items: BomCreatorItemRecord[];
}
export interface CreateBomCreatorInput {
  productItemId: string;
  orgNodeId: string;
  quantityToProduce?: string;
  allowAlternativeItem?: boolean;
  remarks?: string;
  items: BomCreatorItemInput[];
}
