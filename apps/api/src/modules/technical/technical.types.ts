export type DocumentType = 'shop_drawing' | 'cutting_list' | 'other';
export type BomStatus = 'draft' | 'approved' | 'archived';

export interface TechnicalDocumentRecord {
  id: string; jobOrderReference: string; documentType: DocumentType;
  fileReference: string; version: number; note: string | null; createdAt: string;
}
export interface CreateTechnicalDocumentInput {
  jobOrderReference: string; documentType: DocumentType; fileReference: string; note?: string;
}

export interface BomLineRecord { id: string; bomId: string; componentItemId: string; quantity: string; lineNumber: number; }
export interface BomRecord {
  id: string; jobOrderReference: string; productItemId: string; version: number;
  outputQuantity: string; status: BomStatus; lines: BomLineRecord[];
}
export interface CreateBomLineInput { componentItemId: string; quantity: string; }
export interface CreateBomInput {
  jobOrderReference: string; productItemId: string; outputQuantity?: string; lines: CreateBomLineInput[];
}
