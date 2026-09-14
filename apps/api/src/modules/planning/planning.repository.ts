import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { salesForecast, salesForecastLine } from './planning.schema';
import type {
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
}
