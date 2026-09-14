import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { itemLeadTime, planningMaterialRequest, planningMaterialRequestLine, productionPlan, productionPlanItem, salesForecast, salesForecastLine, supplierLeadTime } from './planning.schema';
import type {
  CreateMaterialRequestInput, MaterialRequestLineInput, MaterialRequestLineRecord,
  MaterialRequestRecord, MaterialRequestStatus,
  CreateProductionPlanInput, ProductionPlanItemInput, ProductionPlanItemRecord,
  ProductionPlanRecord, ProductionPlanStatus,
  CreateItemLeadTimeInput, ItemLeadTimeRecord, SupplierLeadTimeInput, SupplierLeadTimeRecord,
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

const ppColumns = {
  id: productionPlan.id, planNumber: productionPlan.planNumber, orgNodeId: productionPlan.orgNodeId,
  planBy: productionPlan.planBy, fromDate: productionPlan.fromDate, toDate: productionPlan.toDate, status: productionPlan.status,
};
const ppItemColumns = {
  id: productionPlanItem.id, productionPlanId: productionPlanItem.productionPlanId, productItemId: productionPlanItem.productItemId,
  bomId: productionPlanItem.bomId, qtyToPlan: productionPlanItem.qtyToPlan, warehouseId: productionPlanItem.warehouseId,
  workOrderId: productionPlanItem.workOrderId, lineNumber: productionPlanItem.lineNumber,
};

interface PpRow {
  id: string; planNumber: string; orgNodeId: string; planBy: string; fromDate: Date; toDate: Date; status: string;
}
interface PpItemRow {
  id: string; productionPlanId: string; productItemId: string; bomId: string;
  qtyToPlan: string; warehouseId: string | null; workOrderId: string | null; lineNumber: number;
}

function toPpItemRecord(row: PpItemRow): ProductionPlanItemRecord {
  return {
    id: row.id, productionPlanId: row.productionPlanId, productItemId: row.productItemId, bomId: row.bomId,
    qtyToPlan: row.qtyToPlan, warehouseId: row.warehouseId, workOrderId: row.workOrderId, lineNumber: row.lineNumber,
  };
}

const iltColumns = {
  id: itemLeadTime.id, itemId: itemLeadTime.itemId, orgNodeId: itemLeadTime.orgNodeId,
  manufacturingTimeHours: itemLeadTime.manufacturingTimeHours, isManufacturingLeadTime: itemLeadTime.isManufacturingLeadTime,
  manufacturingBufferDays: itemLeadTime.manufacturingBufferDays, purchaseTimeDays: itemLeadTime.purchaseTimeDays,
  isPurchaseLeadTime: itemLeadTime.isPurchaseLeadTime, purchaseBufferDays: itemLeadTime.purchaseBufferDays,
};
const sltColumns = {
  id: supplierLeadTime.id, itemLeadTimeId: supplierLeadTime.itemLeadTimeId,
  supplierName: supplierLeadTime.supplierName, leadTimeDays: supplierLeadTime.leadTimeDays,
};

interface IltRow {
  id: string; itemId: string; orgNodeId: string;
  manufacturingTimeHours: string | null; isManufacturingLeadTime: boolean; manufacturingBufferDays: string | null;
  purchaseTimeDays: string | null; isPurchaseLeadTime: boolean; purchaseBufferDays: string | null;
}
interface SltRow { id: string; itemLeadTimeId: string; supplierName: string; leadTimeDays: string; }

function toSltRecord(row: SltRow): SupplierLeadTimeRecord {
  return { id: row.id, itemLeadTimeId: row.itemLeadTimeId, supplierName: row.supplierName, leadTimeDays: row.leadTimeDays };
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

  async listProductionPlans(): Promise<ProductionPlanRecord[]> {
    const rows = await this.database.db.select(ppColumns).from(productionPlan).orderBy(asc(productionPlan.planNumber));
    const results: ProductionPlanRecord[] = [];
    for (const row of rows) {
      const items = await this.listPpItems(row.id);
      results.push(this.toPpRecord(row, items));
    }
    return results;
  }

  async findProductionPlanById(id: string): Promise<ProductionPlanRecord | null> {
    const rows = await this.database.db.select(ppColumns).from(productionPlan).where(eq(productionPlan.id, id)).limit(1);
    if (!rows[0]) return null;
    const items = await this.listPpItems(id);
    return this.toPpRecord(rows[0], items);
  }

  async countProductionPlans(): Promise<number> {
    const rows = await this.database.db.select({ id: productionPlan.id }).from(productionPlan);
    return rows.length;
  }

  private async listPpItems(productionPlanId: string): Promise<ProductionPlanItemRecord[]> {
    const rows = await this.database.db.select(ppItemColumns).from(productionPlanItem)
      .where(eq(productionPlanItem.productionPlanId, productionPlanId)).orderBy(asc(productionPlanItem.lineNumber));
    return rows.map(toPpItemRecord);
  }

  private toPpRecord(row: PpRow, items: ProductionPlanItemRecord[]): ProductionPlanRecord {
    return {
      id: row.id, planNumber: row.planNumber, orgNodeId: row.orgNodeId, planBy: row.planBy as ProductionPlanRecord['planBy'],
      fromDate: row.fromDate.toISOString(), toDate: row.toDate.toISOString(), status: row.status as ProductionPlanStatus, items,
    };
  }

  async insertProductionPlan(input: CreateProductionPlanInput & { id: string; planNumber: string }): Promise<ProductionPlanRecord> {
    const rows = await this.database.db.insert(productionPlan).values({
      id: input.id, planNumber: input.planNumber, orgNodeId: input.orgNodeId, planBy: input.planBy ?? 'job_order',
      fromDate: new Date(input.fromDate), toDate: new Date(input.toDate),
    }).returning(ppColumns);
    const inserted = rows[0]!;
    let lineNumber = 1;
    for (const it of input.items) {
      await this.insertPpItem(inserted.id, it, lineNumber);
      lineNumber += 1;
    }
    const items = await this.listPpItems(inserted.id);
    return this.toPpRecord(inserted, items);
  }

  private async insertPpItem(productionPlanId: string, input: ProductionPlanItemInput, lineNumber: number): Promise<void> {
    await this.database.db.insert(productionPlanItem).values({
      productionPlanId, productItemId: input.productItemId, bomId: input.bomId,
      qtyToPlan: input.qtyToPlan, warehouseId: input.warehouseId ?? null, lineNumber,
    });
  }

  async setProductionPlanStatus(id: string, status: ProductionPlanStatus): Promise<ProductionPlanRecord> {
    const rows = await this.database.db.update(productionPlan).set({ status }).where(eq(productionPlan.id, id)).returning(ppColumns);
    const items = await this.listPpItems(id);
    return this.toPpRecord(rows[0]!, items);
  }

  async setPpItemWorkOrder(itemId: string, workOrderId: string): Promise<void> {
    await this.database.db.update(productionPlanItem).set({ workOrderId }).where(eq(productionPlanItem.id, itemId));
  }

  async listItemLeadTimes(): Promise<ItemLeadTimeRecord[]> {
    const rows = await this.database.db.select(iltColumns).from(itemLeadTime).orderBy(asc(itemLeadTime.itemId));
    const results: ItemLeadTimeRecord[] = [];
    for (const row of rows) {
      const supplierLeadTimes = await this.listSlt(row.id);
      results.push(this.toIltRecord(row, supplierLeadTimes));
    }
    return results;
  }

  async findItemLeadTimeById(id: string): Promise<ItemLeadTimeRecord | null> {
    const rows = await this.database.db.select(iltColumns).from(itemLeadTime).where(eq(itemLeadTime.id, id)).limit(1);
    if (!rows[0]) return null;
    const supplierLeadTimes = await this.listSlt(id);
    return this.toIltRecord(rows[0], supplierLeadTimes);
  }

  async findItemLeadTimeByItemId(itemId: string): Promise<ItemLeadTimeRecord | null> {
    const rows = await this.database.db.select(iltColumns).from(itemLeadTime).where(eq(itemLeadTime.itemId, itemId)).limit(1);
    if (!rows[0]) return null;
    const supplierLeadTimes = await this.listSlt(rows[0].id);
    return this.toIltRecord(rows[0], supplierLeadTimes);
  }

  private async listSlt(itemLeadTimeId: string): Promise<SupplierLeadTimeRecord[]> {
    const rows = await this.database.db.select(sltColumns).from(supplierLeadTime).where(eq(supplierLeadTime.itemLeadTimeId, itemLeadTimeId));
    return rows.map(toSltRecord);
  }

  private toIltRecord(row: IltRow, supplierLeadTimes: SupplierLeadTimeRecord[]): ItemLeadTimeRecord {
    return {
      id: row.id, itemId: row.itemId, orgNodeId: row.orgNodeId,
      manufacturingTimeHours: row.manufacturingTimeHours, isManufacturingLeadTime: row.isManufacturingLeadTime,
      manufacturingBufferDays: row.manufacturingBufferDays, purchaseTimeDays: row.purchaseTimeDays,
      isPurchaseLeadTime: row.isPurchaseLeadTime, purchaseBufferDays: row.purchaseBufferDays, supplierLeadTimes,
    };
  }

  async insertItemLeadTime(input: CreateItemLeadTimeInput & { id: string }): Promise<ItemLeadTimeRecord> {
    const rows = await this.database.db.insert(itemLeadTime).values({
      id: input.id, itemId: input.itemId, orgNodeId: input.orgNodeId,
      manufacturingTimeHours: input.manufacturingTimeHours ?? null, isManufacturingLeadTime: input.isManufacturingLeadTime ?? false,
      manufacturingBufferDays: input.manufacturingBufferDays ?? null, purchaseTimeDays: input.purchaseTimeDays ?? null,
      isPurchaseLeadTime: input.isPurchaseLeadTime ?? false, purchaseBufferDays: input.purchaseBufferDays ?? null,
    }).returning(iltColumns);
    const inserted = rows[0]!;
    for (const s of input.supplierLeadTimes ?? []) {
      await this.database.db.insert(supplierLeadTime).values({ itemLeadTimeId: inserted.id, supplierName: s.supplierName, leadTimeDays: s.leadTimeDays });
    }
    const supplierLeadTimes = await this.listSlt(inserted.id);
    return this.toIltRecord(inserted, supplierLeadTimes);
  }
}
