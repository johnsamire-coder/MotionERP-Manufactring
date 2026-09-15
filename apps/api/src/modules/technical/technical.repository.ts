import { Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { bom, bomCreator, bomCreatorItem, bomLine, technicalDocument } from './technical.schema';
import type {
  BomLineRecord, BomRecord, BomStatus, ConsumeComponentsBasedOn, CreateBomInput, CreateTechnicalDocumentInput,
  DocumentType, TechnicalDocumentRecord,
  BomCreatorItemInput, BomCreatorItemRecord, BomCreatorRecord, CreateBomCreatorInput,
} from './technical.types';
const docColumns = {
  id: technicalDocument.id, jobOrderReference: technicalDocument.jobOrderReference, orgNodeId: technicalDocument.orgNodeId,
  documentType: technicalDocument.documentType, fileReference: technicalDocument.fileReference,
  version: technicalDocument.version, note: technicalDocument.note, createdAt: technicalDocument.createdAt,
};
const bomColumns = {
  id: bom.id, productItemId: bom.productItemId, orgNodeId: bom.orgNodeId, version: bom.version,
  outputQuantity: bom.outputQuantity, isActive: bom.isActive, isDefault: bom.isDefault, isPhantomBom: bom.isPhantomBom,
  allowAlternativeItem: bom.allowAlternativeItem, qualityInspectionRequired: bom.qualityInspectionRequired,
  consumeComponentsBasedOn: bom.consumeComponentsBasedOn, defaultSourceWarehouseId: bom.defaultSourceWarehouseId,
  defaultTargetWarehouseId: bom.defaultTargetWarehouseId, status: bom.status,
};
const bomLineColumns = { id: bomLine.id, bomId: bomLine.bomId, componentItemId: bomLine.componentItemId, quantity: bomLine.quantity, lineNumber: bomLine.lineNumber };
interface DocRow { id: string; jobOrderReference: string; orgNodeId: string | null; documentType: string; fileReference: string; version: number; note: string | null; createdAt: Date; }
interface BomRow {
  id: string; productItemId: string; orgNodeId: string; version: number; outputQuantity: string;
  isActive: boolean; isDefault: boolean; isPhantomBom: boolean; allowAlternativeItem: boolean;
  qualityInspectionRequired: boolean; consumeComponentsBasedOn: string;
  defaultSourceWarehouseId: string | null; defaultTargetWarehouseId: string | null; status: string;
}
interface BomLineRow { id: string; bomId: string; componentItemId: string; quantity: string; lineNumber: number; }
function toDocRecord(row: DocRow): TechnicalDocumentRecord {
  return { id: row.id, jobOrderReference: row.jobOrderReference, orgNodeId: row.orgNodeId, documentType: row.documentType as DocumentType,
    fileReference: row.fileReference, version: row.version, note: row.note, createdAt: row.createdAt.toISOString() };
}
function toBomLineRecord(row: BomLineRow): BomLineRecord {
  return { id: row.id, bomId: row.bomId, componentItemId: row.componentItemId, quantity: row.quantity, lineNumber: row.lineNumber };
}
function toBomRecord(row: BomRow, lines: BomLineRecord[]): BomRecord {
  return {
    id: row.id, productItemId: row.productItemId, orgNodeId: row.orgNodeId, version: row.version, outputQuantity: row.outputQuantity,
    isActive: row.isActive, isDefault: row.isDefault, isPhantomBom: row.isPhantomBom, allowAlternativeItem: row.allowAlternativeItem,
    qualityInspectionRequired: row.qualityInspectionRequired, consumeComponentsBasedOn: row.consumeComponentsBasedOn as ConsumeComponentsBasedOn,
    defaultSourceWarehouseId: row.defaultSourceWarehouseId, defaultTargetWarehouseId: row.defaultTargetWarehouseId,
    status: row.status as BomStatus, lines,
  };
}
const bcColumns = {
  id: bomCreator.id, creatorNumber: bomCreator.creatorNumber, productItemId: bomCreator.productItemId,
  orgNodeId: bomCreator.orgNodeId, quantityToProduce: bomCreator.quantityToProduce,
  allowAlternativeItem: bomCreator.allowAlternativeItem, remarks: bomCreator.remarks, status: bomCreator.status,
};
const bciColumns = {
  id: bomCreatorItem.id, bomCreatorId: bomCreatorItem.bomCreatorId, parentId: bomCreatorItem.parentId,
  componentItemId: bomCreatorItem.componentItemId, quantity: bomCreatorItem.quantity,
  isSubAssembly: bomCreatorItem.isSubAssembly, generatedBomId: bomCreatorItem.generatedBomId, lineNumber: bomCreatorItem.lineNumber,
};

interface BcRow {
  id: string; creatorNumber: string; productItemId: string; orgNodeId: string; quantityToProduce: string;
  allowAlternativeItem: boolean; remarks: string | null; status: string;
}

function toBciRecord(row: BomCreatorItemRecord): BomCreatorItemRecord { return row; }

@Injectable()
export class TechnicalRepository {
  constructor(private readonly database: DatabaseService) {}
  async listDocuments(jobOrderReference?: string): Promise<TechnicalDocumentRecord[]> {
    const rows = jobOrderReference
      ? await this.database.db.select(docColumns).from(technicalDocument).where(eq(technicalDocument.jobOrderReference, jobOrderReference)).orderBy(asc(technicalDocument.createdAt))
      : await this.database.db.select(docColumns).from(technicalDocument).orderBy(asc(technicalDocument.createdAt));
    return rows.map(toDocRecord);
  }
  async insertDocument(input: CreateTechnicalDocumentInput & { id: string; orgNodeId: string | null }): Promise<TechnicalDocumentRecord> {
    const rows = await this.database.db.insert(technicalDocument).values({
      id: input.id, jobOrderReference: input.jobOrderReference, orgNodeId: input.orgNodeId, documentType: input.documentType,
      fileReference: input.fileReference, note: input.note ?? null,
    }).returning(docColumns);
    return toDocRecord(rows[0]!);
  }
  async listBoms(productItemId?: string): Promise<BomRecord[]> {
    const boms = productItemId
      ? await this.database.db.select(bomColumns).from(bom).where(eq(bom.productItemId, productItemId)).orderBy(asc(bom.version))
      : await this.database.db.select(bomColumns).from(bom).orderBy(asc(bom.version));
    const allLines = await this.database.db.select(bomLineColumns).from(bomLine).orderBy(asc(bomLine.lineNumber));
    return boms.map((b) => toBomRecord(b, allLines.filter((l) => l.bomId === b.id).map(toBomLineRecord)));
  }
  async findBomById(id: string): Promise<BomRecord | null> {
    const rows = await this.database.db.select(bomColumns).from(bom).where(eq(bom.id, id)).limit(1);
    if (!rows[0]) return null;
    const lines = await this.database.db.select(bomLineColumns).from(bomLine).where(eq(bomLine.bomId, id)).orderBy(asc(bomLine.lineNumber));
    return toBomRecord(rows[0], lines.map(toBomLineRecord));
  }
  async findBomByItemAndVersion(productItemId: string, version: number): Promise<BomRecord | null> {
    const rows = await this.database.db.select(bomColumns).from(bom).where(eq(bom.productItemId, productItemId)).limit(200);
    const match = rows.find((r) => r.version === version);
    return match ? toBomRecord(match, []) : null;
  }
  async clearDefaultForItem(productItemId: string): Promise<void> {
    await this.database.db.update(bom).set({ isDefault: false }).where(eq(bom.productItemId, productItemId));
  }
  async insertBom(input: CreateBomInput & { id: string; version: number }): Promise<BomRecord> {
    const rows = await this.database.db.insert(bom).values({
      id: input.id, productItemId: input.productItemId, orgNodeId: input.orgNodeId, version: input.version,
      outputQuantity: input.outputQuantity ?? '1', isActive: input.isActive ?? true, isDefault: input.isDefault ?? false,
      isPhantomBom: input.isPhantomBom ?? false, allowAlternativeItem: input.allowAlternativeItem ?? false,
      qualityInspectionRequired: input.qualityInspectionRequired ?? false,
      consumeComponentsBasedOn: input.consumeComponentsBasedOn ?? 'bom',
      defaultSourceWarehouseId: input.defaultSourceWarehouseId ?? null, defaultTargetWarehouseId: input.defaultTargetWarehouseId ?? null,
    }).returning(bomColumns);
    const inserted = rows[0]!;
    const lines: BomLineRecord[] = [];
    let lineNumber = 1;
    for (const line of input.lines) {
      const lineRows = await this.database.db.insert(bomLine).values({
        bomId: inserted.id, componentItemId: line.componentItemId, quantity: line.quantity, lineNumber,
      }).returning(bomLineColumns);
      lines.push(toBomLineRecord(lineRows[0]!));
      lineNumber += 1;
    }
    return toBomRecord(inserted, lines);
  }
  async setBomStatus(id: string, status: BomStatus): Promise<BomRecord> {
    const rows = await this.database.db.update(bom).set({ status }).where(eq(bom.id, id)).returning(bomColumns);
    const lines = await this.database.db.select(bomLineColumns).from(bomLine).where(eq(bomLine.bomId, id)).orderBy(asc(bomLine.lineNumber));
    return toBomRecord(rows[0]!, lines.map(toBomLineRecord));
  }

  async listBomCreators(): Promise<BomCreatorRecord[]> {
    const rows = await this.database.db.select(bcColumns).from(bomCreator).orderBy(asc(bomCreator.creatorNumber));
    const results: BomCreatorRecord[] = [];
    for (const row of rows) {
      const items = await this.listBcItems(row.id);
      results.push(this.toBcRecord(row, items));
    }
    return results;
  }

  async findBomCreatorById(id: string): Promise<BomCreatorRecord | null> {
    const rows = await this.database.db.select(bcColumns).from(bomCreator).where(eq(bomCreator.id, id)).limit(1);
    if (!rows[0]) return null;
    const items = await this.listBcItems(id);
    return this.toBcRecord(rows[0], items);
  }

  async countBomCreators(): Promise<number> {
    const rows = await this.database.db.select({ id: bomCreator.id }).from(bomCreator);
    return rows.length;
  }

  private async listBcItems(bomCreatorId: string): Promise<BomCreatorItemRecord[]> {
    const rows = await this.database.db.select(bciColumns).from(bomCreatorItem)
      .where(eq(bomCreatorItem.bomCreatorId, bomCreatorId)).orderBy(asc(bomCreatorItem.lineNumber));
    return rows.map(toBciRecord);
  }

  private toBcRecord(row: BcRow, items: BomCreatorItemRecord[]): BomCreatorRecord {
    return {
      id: row.id, creatorNumber: row.creatorNumber, productItemId: row.productItemId, orgNodeId: row.orgNodeId,
      quantityToProduce: row.quantityToProduce, allowAlternativeItem: row.allowAlternativeItem,
      remarks: row.remarks, status: row.status as BomCreatorRecord["status"], items,
    };
  }

  async insertBomCreator(input: CreateBomCreatorInput & { id: string; creatorNumber: string }): Promise<BomCreatorRecord> {
    const rows = await this.database.db.insert(bomCreator).values({
      id: input.id, creatorNumber: input.creatorNumber, productItemId: input.productItemId, orgNodeId: input.orgNodeId,
      quantityToProduce: input.quantityToProduce ?? '1', allowAlternativeItem: input.allowAlternativeItem ?? false, remarks: input.remarks ?? null,
    }).returning(bcColumns);
    const inserted = rows[0]!;
    const idMap = new Map<number, string>();
    let lineNumber = 1;
    for (const it of input.items) {
      const newId = await this.insertBcItem(inserted.id, it, lineNumber, idMap);
      idMap.set(it.tempId, newId);
      lineNumber += 1;
    }
    const items = await this.listBcItems(inserted.id);
    return this.toBcRecord(inserted, items);
  }

  private async insertBcItem(bomCreatorId: string, input: BomCreatorItemInput, lineNumber: number, idMap: Map<number, string>): Promise<string> {
    const parentId = input.parentTempId !== undefined ? (idMap.get(input.parentTempId) ?? null) : null;
    const rows = await this.database.db.insert(bomCreatorItem).values({
      bomCreatorId, parentId, componentItemId: input.componentItemId,
      quantity: input.quantity, isSubAssembly: input.isSubAssembly ?? false, lineNumber,
    }).returning({ id: bomCreatorItem.id });
    return rows[0]!.id;
  }

  async setBcItemGeneratedBom(itemId: string, generatedBomId: string): Promise<void> {
    await this.database.db.update(bomCreatorItem).set({ generatedBomId }).where(eq(bomCreatorItem.id, itemId));
  }

  async setBomCreatorStatus(id: string, status: "draft" | "completed"): Promise<BomCreatorRecord> {
    const rows = await this.database.db.update(bomCreator).set({ status }).where(eq(bomCreator.id, id)).returning(bcColumns);
    const items = await this.listBcItems(id);
    return this.toBcRecord(rows[0]!, items);
  }
}
