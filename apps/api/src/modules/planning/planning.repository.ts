import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { planningMaterialRequest, planningMaterialRequestLine, salesForecast, salesForecastLine } from './planning.schema';
import type {
  CreateMaterialRequestInput, MaterialRequestLineInput, MaterialRequestLineRecord,
  MaterialRequestRecord, MaterialRequestStatus,
  CreateSalesForecastInput, SalesForecastLineInput, SalesForecastLineRecord,
  SalesForecastRecord, SalesForecastStatus,
} from './planning.types';

const sfColumns = {
  id: salesForecast.id, forecastNumber: salesForecast.forecastNumber, orgNodeId: salesForecast.orgNodeId,
  itemCategoryId: salesForecast.itemCategoryId, warehouseId: salesForecast.warehouseId,
  fromDate: salesForecast.fromDate, toDate: salesForecast.toDate, basedOn: salesForecast.basedOn,
  forecastPeriodicity: salesForecast.forecastPeriodicity, status: salesForecast.status,
};
const sfLineColumns = {
  id: salesForecastLine.id, salesForecastId: salesForecastLine.salesForecastId, itemId: salesForecastLine.itemId,
  warehouseId: salesForecastLine.warehouseId, forecastQuantity: salesForecastLine.forecastQuantity,
  plannedQuantity: salesForecastLine.plannedQuantity, lineNumber: salesForecastLine.lineNumber,
};

interface SfRow {
  id: string; forecastNumber: string; orgNodeId: string; itemCategoryId: string; warehouseId: string | null;
  fromDate: Date; toDate: Date; basedOn: string; forecastPeriodicity: string; status: string;
}
interface SfLineRow {
  id: string; salesForecastId: string; itemId: string; warehouseId: string | null;
  forecastQuantity: string; plannedQuantity: string | null; lineNumber: number;
}

function toLineRecord(row: SfLineRow): SalesForecastLineRecord {
  return {
    id: row.id, salesForecastId: row.salesForecastId, itemId: row.itemId, warehouseId: row.warehouseId,
    forecastQuantity: row.forecastQuantity, plannedQuantity: row.plannedQuantity, lineNumber: row.lineNumber,
  };
}

const mrColumns = {
  id: planningMaterialRequest.id, requestNumber: planningMaterialRequest.requestNumber, orgNodeId: planningMaterialRequest.orgNodeId,
  purpose: planningMaterialRequest.purpose, transactionDate: planningMaterialRequest.transactionDate,
  requiredByDate: planningMaterialRequest.requiredByDate, jobOrderReference: planningMaterialRequest.jobOrderReference,
  status: planningMaterialRequest.status,
};
const mrLineColumns = {
  id: planningMaterialRequestLine.id, materialRequestId: planningMaterialRequestLine.materialRequestId,
  itemId: planningMaterialRequestLine.itemId, warehouseId: planningMaterialRequestLine.warehouseId,
  quantity: planningMaterialRequestLine.quantity, scheduleDate: planningMaterialRequestLine.scheduleDate,
  lineNumber: planningMaterialRequestLine.lineNumber,
};

interface MrRow {
  id: string; requestNumber: string; orgNodeId: string; purpose: string; transactionDate: Date;
  requiredByDate: Date | null; jobOrderReference: string | null; status: string;
}
interface MrLineRow {
  id: string; materialRequestId: string; itemId: string; warehouseId: string | null;
  quantity: string; scheduleDate: Date | null; lineNumber: number;
}

function toMrLineRecord(row: MrLineRow): MaterialRequestLineRecord {
  return {
    id: row.id, materialRequestId: row.materialRequestId, itemId: row.itemId, warehouseId: row.warehouseId,
    quantity: row.quantity, scheduleDate: row.scheduleDate ? row.scheduleDate.toISOString() : null, lineNumber: row.lineNumber,
  };
}

@Injectable()
export class PlanningRepository {
  constructor(private readonly database: DatabaseService) {}

  async listSalesForecasts(): Promise<SalesForecastRecord[]> {
    const rows = await this.database.db.select(sfColumns).from(salesForecast).orderBy(asc(salesForecast.forecastNumber));
    const results: SalesForecastRecord[] = [];
    for (const row of rows) {
      const lines = await this.listLines(row.id);
      results.push(this.toRecord(row, lines));
    }
    return results;
  }

  async findSalesForecastById(id: string): Promise<SalesForecastRecord | null> {
    const rows = await this.database.db.select(sfColumns).from(salesForecast).where(eq(salesForecast.id, id)).limit(1);
    if (!rows[0]) return null;
    const lines = await this.listLines(id);
    return this.toRecord(rows[0], lines);
  }

  async countSalesForecasts(): Promise<number> {
    const rows = await this.database.db.select({ id: salesForecast.id }).from(salesForecast);
    return rows.length;
  }

  private async listLines(salesForecastId: string): Promise<SalesForecastLineRecord[]> {
    const rows = await this.database.db.select(sfLineColumns).from(salesForecastLine)
      .where(eq(salesForecastLine.salesForecastId, salesForecastId)).orderBy(asc(salesForecastLine.lineNumber));
    return rows.map(toLineRecord);
  }

  private toRecord(row: SfRow, lines: SalesForecastLineRecord[]): SalesForecastRecord {
    return {
      id: row.id, forecastNumber: row.forecastNumber, orgNodeId: row.orgNodeId, itemCategoryId: row.itemCategoryId,
      warehouseId: row.warehouseId, fromDate: row.fromDate.toISOString(), toDate: row.toDate.toISOString(),
      basedOn: row.basedOn as 'job_order', forecastPeriodicity: row.forecastPeriodicity as SalesForecastRecord['forecastPeriodicity'],
      status: row.status as SalesForecastStatus, lines,
    };
  }

  async insertSalesForecast(input: CreateSalesForecastInput & { id: string; forecastNumber: string }): Promise<SalesForecastRecord> {
    const rows = await this.database.db.insert(salesForecast).values({
      id: input.id, forecastNumber: input.forecastNumber, orgNodeId: input.orgNodeId, itemCategoryId: input.itemCategoryId,
      warehouseId: input.warehouseId ?? null, fromDate: new Date(input.fromDate), toDate: new Date(input.toDate),
      forecastPeriodicity: input.forecastPeriodicity ?? 'monthly',
    }).returning(sfColumns);
    const inserted = rows[0]!;
    let lineNumber = 1;
    for (const line of input.lines) {
      await this.insertLine(inserted.id, line, lineNumber);
      lineNumber += 1;
    }
    const lines = await this.listLines(inserted.id);
    return this.toRecord(inserted, lines);
  }

  private async insertLine(salesForecastId: string, input: SalesForecastLineInput, lineNumber: number): Promise<void> {
    await this.database.db.insert(salesForecastLine).values({
      salesForecastId, itemId: input.itemId, warehouseId: input.warehouseId ?? null,
      forecastQuantity: input.forecastQuantity, plannedQuantity: input.plannedQuantity ?? null, lineNumber,
    });
  }

  async setSalesForecastStatus(id: string, status: SalesForecastStatus): Promise<SalesForecastRecord> {
    const rows = await this.database.db.update(salesForecast).set({ status }).where(eq(salesForecast.id, id)).returning(sfColumns);
    const lines = await this.listLines(id);
    return this.toRecord(rows[0]!, lines);
  }

  async listMaterialRequests(): Promise<MaterialRequestRecord[]> {
    const rows = await this.database.db.select(mrColumns).from(planningMaterialRequest).orderBy(asc(planningMaterialRequest.requestNumber));
    const results: MaterialRequestRecord[] = [];
    for (const row of rows) {
      const lines = await this.listMrLines(row.id);
      results.push(this.toMrRecord(row, lines));
    }
    return results;
  }

  async findMaterialRequestById(id: string): Promise<MaterialRequestRecord | null> {
    const rows = await this.database.db.select(mrColumns).from(planningMaterialRequest).where(eq(planningMaterialRequest.id, id)).limit(1);
    if (!rows[0]) return null;
    const lines = await this.listMrLines(id);
    return this.toMrRecord(rows[0], lines);
  }

  async countMaterialRequests(): Promise<number> {
    const rows = await this.database.db.select({ id: planningMaterialRequest.id }).from(planningMaterialRequest);
    return rows.length;
  }

  private async listMrLines(materialRequestId: string): Promise<MaterialRequestLineRecord[]> {
    const rows = await this.database.db.select(mrLineColumns).from(planningMaterialRequestLine)
      .where(eq(planningMaterialRequestLine.materialRequestId, materialRequestId)).orderBy(asc(planningMaterialRequestLine.lineNumber));
    return rows.map(toMrLineRecord);
  }

  private toMrRecord(row: MrRow, lines: MaterialRequestLineRecord[]): MaterialRequestRecord {
    return {
      id: row.id, requestNumber: row.requestNumber, orgNodeId: row.orgNodeId, purpose: row.purpose as MaterialRequestRecord['purpose'],
      transactionDate: row.transactionDate.toISOString(), requiredByDate: row.requiredByDate ? row.requiredByDate.toISOString() : null,
      jobOrderReference: row.jobOrderReference, status: row.status as MaterialRequestStatus, lines,
    };
  }

  async insertMaterialRequest(input: CreateMaterialRequestInput & { id: string; requestNumber: string }): Promise<MaterialRequestRecord> {
    const rows = await this.database.db.insert(planningMaterialRequest).values({
      id: input.id, requestNumber: input.requestNumber, orgNodeId: input.orgNodeId, purpose: input.purpose ?? 'manufacture',
      requiredByDate: input.requiredByDate ? new Date(input.requiredByDate) : null, jobOrderReference: input.jobOrderReference ?? null,
    }).returning(mrColumns);
    const inserted = rows[0]!;
    let lineNumber = 1;
    for (const line of input.lines) {
      await this.insertMrLine(inserted.id, line, lineNumber);
      lineNumber += 1;
    }
    const lines = await this.listMrLines(inserted.id);
    return this.toMrRecord(inserted, lines);
  }

  private async insertMrLine(materialRequestId: string, input: MaterialRequestLineInput, lineNumber: number): Promise<void> {
    await this.database.db.insert(planningMaterialRequestLine).values({
      materialRequestId, itemId: input.itemId, warehouseId: input.warehouseId ?? null,
      quantity: input.quantity, scheduleDate: input.scheduleDate ? new Date(input.scheduleDate) : null, lineNumber,
    });
  }

  async setMaterialRequestStatus(id: string, status: MaterialRequestStatus): Promise<MaterialRequestRecord> {
    const rows = await this.database.db.update(planningMaterialRequest).set({ status }).where(eq(planningMaterialRequest.id, id)).returning(mrColumns);
    const lines = await this.listMrLines(id);
    return this.toMrRecord(rows[0]!, lines);
  }
}
