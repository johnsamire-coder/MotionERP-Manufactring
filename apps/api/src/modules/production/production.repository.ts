import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { materialRequest } from './production.schema';
import type { CreateMaterialRequestInput, MaterialRequestRecord, MaterialRequestStatus } from './production.types';

const columns = {
  id: materialRequest.id, jobOrderReference: materialRequest.jobOrderReference, orgNodeId: materialRequest.orgNodeId,
  itemId: materialRequest.itemId,
  warehouseId: materialRequest.warehouseId, plannedQuantity: materialRequest.plannedQuantity,
  requestedQuantity: materialRequest.requestedQuantity, issuedQuantity: materialRequest.issuedQuantity,
  actualUsedQuantity: materialRequest.actualUsedQuantity, status: materialRequest.status,
  deviationReason: materialRequest.deviationReason, createdAt: materialRequest.createdAt, updatedAt: materialRequest.updatedAt,
};

interface Row {
  id: string; jobOrderReference: string; orgNodeId: string | null; itemId: string; warehouseId: string;
  plannedQuantity: string; requestedQuantity: string; issuedQuantity: string | null;
  actualUsedQuantity: string | null; status: string; deviationReason: string | null;
  createdAt: Date; updatedAt: Date;
}

function toRecord(row: Row): MaterialRequestRecord {
  return {
    id: row.id, jobOrderReference: row.jobOrderReference, orgNodeId: row.orgNodeId, itemId: row.itemId, warehouseId: row.warehouseId,
    plannedQuantity: row.plannedQuantity, requestedQuantity: row.requestedQuantity, issuedQuantity: row.issuedQuantity,
    actualUsedQuantity: row.actualUsedQuantity, status: row.status as MaterialRequestStatus,
    deviationReason: row.deviationReason, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class ProductionRepository {
  constructor(private readonly database: DatabaseService) {}

  async listRequests(jobOrderReference?: string): Promise<MaterialRequestRecord[]> {
    const rows = jobOrderReference
      ? await this.database.db.select(columns).from(materialRequest).where(eq(materialRequest.jobOrderReference, jobOrderReference)).orderBy(asc(materialRequest.createdAt))
      : await this.database.db.select(columns).from(materialRequest).orderBy(asc(materialRequest.createdAt));
    return rows.map(toRecord);
  }

  async findRequestById(id: string): Promise<MaterialRequestRecord | null> {
    const rows = await this.database.db.select(columns).from(materialRequest).where(eq(materialRequest.id, id)).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async insertRequest(input: CreateMaterialRequestInput & { id: string; status: MaterialRequestStatus; orgNodeId: string | null }): Promise<MaterialRequestRecord> {
    const rows = await this.database.db.insert(materialRequest).values({
      id: input.id, jobOrderReference: input.jobOrderReference, orgNodeId: input.orgNodeId, itemId: input.itemId, warehouseId: input.warehouseId,
      plannedQuantity: input.plannedQuantity, requestedQuantity: input.requestedQuantity, status: input.status,
    }).returning(columns);
    return toRecord(rows[0]!);
  }

  async setStatus(id: string, status: MaterialRequestStatus, deviationReason?: string): Promise<MaterialRequestRecord> {
    const fields: { status: MaterialRequestStatus; deviationReason?: string } = { status };
    if (deviationReason !== undefined) fields.deviationReason = deviationReason;
    const rows = await this.database.db.update(materialRequest).set(fields).where(eq(materialRequest.id, id)).returning(columns);
    return toRecord(rows[0]!);
  }

  async recordIssue(id: string, issuedQuantity: string): Promise<MaterialRequestRecord> {
    const rows = await this.database.db.update(materialRequest)
      .set({ issuedQuantity, status: 'issued' }).where(eq(materialRequest.id, id)).returning(columns);
    return toRecord(rows[0]!);
  }

  async closeRequest(id: string, actualUsedQuantity: string): Promise<MaterialRequestRecord> {
    const rows = await this.database.db.update(materialRequest)
      .set({ actualUsedQuantity, status: 'closed' }).where(eq(materialRequest.id, id)).returning(columns);
    return toRecord(rows[0]!);
  }
}
