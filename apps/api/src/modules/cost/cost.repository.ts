import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import {
  allocationPolicy,
  allocationResult,
  costComponentType,
  costEntry,
  jobCostSheet,
  overheadPool,
  overheadPoolEntry,
} from './cost.schema';
import type {
  AllocationBase,
  AllocationPolicyRecord,
  AllocationResultRecord,
  CostComponentTypeRecord,
  CostEntryType,
  CostEntryRecord,
  CreateAllocationPolicyInput,
  CreateCostComponentTypeInput,
  CreateCostEntryInput,
  CreateJobCostSheetInput,
  CreateOverheadPoolInput,
  JobCostSheetRecord,
  JobCostSheetStatus,
  OverheadPoolEntryRecord,
  OverheadPoolRecord,
  PoolStatus,
  PoolType,
} from './cost.types';

/* ═══ column maps ═══ */
const ctCols = {
  id: costComponentType.id,
  code: costComponentType.code,
  name: costComponentType.name,
  description: costComponentType.description,
};
const sheetCols = {
  id: jobCostSheet.id,
  jobOrderReference: jobCostSheet.jobOrderReference,
  orgNodeId: jobCostSheet.orgNodeId,
  currencyCode: jobCostSheet.currencyCode,
  status: jobCostSheet.status,
};
const entryCols = {
  id: costEntry.id,
  costSheetId: costEntry.costSheetId,
  componentTypeId: costEntry.componentTypeId,
  entryType: costEntry.entryType,
  amount: costEntry.amount,
  currencyCode: costEntry.currencyCode,
  description: costEntry.description,
  sourceReference: costEntry.sourceReference,
};
const poolCols = {
  id: overheadPool.id,
  code: overheadPool.code,
  name: overheadPool.name,
  poolType: overheadPool.poolType,
  periodStart: overheadPool.periodStart,
  periodEnd: overheadPool.periodEnd,
  totalAmount: overheadPool.totalAmount,
  currencyCode: overheadPool.currencyCode,
  status: overheadPool.status,
  orgNodeId: overheadPool.orgNodeId,
};
const poolEntryCols = {
  id: overheadPoolEntry.id,
  poolId: overheadPoolEntry.poolId,
  accountId: overheadPoolEntry.accountId,
  description: overheadPoolEntry.description,
  amount: overheadPoolEntry.amount,
  sourceReference: overheadPoolEntry.sourceReference,
  recordedAt: overheadPoolEntry.recordedAt,
};
const policyCols = {
  id: allocationPolicy.id,
  code: allocationPolicy.code,
  name: allocationPolicy.name,
  poolId: allocationPolicy.poolId,
  allocationBase: allocationPolicy.allocationBase,
  percentage: allocationPolicy.percentage,
  isActive: allocationPolicy.isActive,
  orgNodeId: allocationPolicy.orgNodeId,
  appliedAccountId: allocationPolicy.appliedAccountId,
  journalEntryId: allocationPolicy.journalEntryId,
};
const resultCols = {
  id: allocationResult.id,
  policyId: allocationResult.policyId,
  workOrderId: allocationResult.workOrderId,
  jobOrderReference: allocationResult.jobOrderReference,
  allocatedAmount: allocationResult.allocatedAmount,
  baseQuantity: allocationResult.baseQuantity,
  baseRate: allocationResult.baseRate,
  periodStart: allocationResult.periodStart,
  periodEnd: allocationResult.periodEnd,
  allocatedAt: allocationResult.allocatedAt,
};

/* ═══ mappers ═══ */
const toCt = (
  r: Pick<typeof costComponentType.$inferSelect, keyof typeof ctCols>,
): CostComponentTypeRecord => ({
  id: r.id,
  code: r.code,
  name: r.name,
  description: r.description,
});
const toSheet = (
  r: Pick<typeof jobCostSheet.$inferSelect, keyof typeof sheetCols>,
): JobCostSheetRecord => ({
  id: r.id,
  jobOrderReference: r.jobOrderReference,
  orgNodeId: r.orgNodeId,
  currencyCode: r.currencyCode,
  status: r.status as JobCostSheetStatus,
});
const toEntry = (
  r: Pick<typeof costEntry.$inferSelect, keyof typeof entryCols>,
): CostEntryRecord => ({
  id: r.id,
  costSheetId: r.costSheetId,
  componentTypeId: r.componentTypeId,
  entryType: r.entryType as CostEntryType,
  amount: r.amount,
  currencyCode: r.currencyCode,
  description: r.description,
  sourceReference: r.sourceReference,
});
const toPool = (
  r: Pick<typeof overheadPool.$inferSelect, keyof typeof poolCols>,
): OverheadPoolRecord => ({
  id: r.id,
  code: r.code,
  name: r.name,
  poolType: r.poolType as PoolType,
  periodStart: r.periodStart instanceof Date ? r.periodStart.toISOString() : String(r.periodStart),
  periodEnd: r.periodEnd instanceof Date ? r.periodEnd.toISOString() : String(r.periodEnd),
  totalAmount: String(r.totalAmount),
  currencyCode: r.currencyCode,
  status: r.status as PoolStatus,
  orgNodeId: r.orgNodeId,
});
const toPoolEntry = (
  r: Pick<typeof overheadPoolEntry.$inferSelect, keyof typeof poolEntryCols>,
): OverheadPoolEntryRecord => ({
  id: r.id,
  poolId: r.poolId,
  accountId: r.accountId,
  description: r.description,
  amount: String(r.amount),
  sourceReference: r.sourceReference,
  recordedAt: r.recordedAt instanceof Date ? r.recordedAt.toISOString() : String(r.recordedAt),
});
const toPolicy = (
  r: Pick<typeof allocationPolicy.$inferSelect, keyof typeof policyCols>,
): AllocationPolicyRecord => ({
  id: r.id,
  code: r.code,
  name: r.name,
  poolId: r.poolId,
  allocationBase: r.allocationBase as AllocationBase,
  percentage: String(r.percentage),
  isActive: r.isActive,
  orgNodeId: r.orgNodeId,
  appliedAccountId: r.appliedAccountId,
  journalEntryId: r.journalEntryId,
});
const toResult = (
  r: Pick<typeof allocationResult.$inferSelect, keyof typeof resultCols>,
): AllocationResultRecord => ({
  id: r.id,
  policyId: r.policyId,
  workOrderId: r.workOrderId,
  jobOrderReference: r.jobOrderReference,
  allocatedAmount: String(r.allocatedAmount),
  baseQuantity: String(r.baseQuantity),
  baseRate: String(r.baseRate),
  periodStart: r.periodStart instanceof Date ? r.periodStart.toISOString() : String(r.periodStart),
  periodEnd: r.periodEnd instanceof Date ? r.periodEnd.toISOString() : String(r.periodEnd),
  allocatedAt: r.allocatedAt instanceof Date ? r.allocatedAt.toISOString() : String(r.allocatedAt),
});

@Injectable()
export class CostRepository {
  constructor(private readonly db: DatabaseService) {}

  /* ── Component Types ── */
  async findComponentTypeById(id: string) {
    const rows = await this.db.db
      .select(ctCols)
      .from(costComponentType)
      .where(eq(costComponentType.id, id))
      .limit(1);
    return rows[0] ? toCt(rows[0]) : null;
  }
  async findComponentTypeByCode(code: string) {
    const rows = await this.db.db
      .select(ctCols)
      .from(costComponentType)
      .where(eq(costComponentType.code, code))
      .limit(1);
    return rows[0] ? toCt(rows[0]) : null;
  }
  async insertComponentType(input: CreateCostComponentTypeInput & { id: string }) {
    const rows = await this.db.db
      .insert(costComponentType)
      .values({ id: input.id, code: input.code, name: input.name, description: input.description })
      .returning(ctCols);
    return toCt(rows[0]!);
  }

  /* ── Cost Sheets ── */
  async findCostSheetByJobOrder(ref: string) {
    const rows = await this.db.db
      .select(sheetCols)
      .from(jobCostSheet)
      .where(eq(jobCostSheet.jobOrderReference, ref))
      .limit(1);
    return rows[0] ? toSheet(rows[0]) : null;
  }
  async insertCostSheet(input: CreateJobCostSheetInput & { id: string; orgNodeId: string | null }) {
    const rows = await this.db.db
      .insert(jobCostSheet)
      .values({
        id: input.id,
        jobOrderReference: input.jobOrderReference,
        orgNodeId: input.orgNodeId,
        currencyCode: input.currencyCode ?? 'EGP',
      })
      .returning(sheetCols);
    return toSheet(rows[0]!);
  }

  /* ── Cost Entries ── */
  async insertCostEntry(input: CreateCostEntryInput & { id: string }) {
    const rows = await this.db.db
      .insert(costEntry)
      .values({
        id: input.id,
        costSheetId: input.costSheetId,
        componentTypeId: input.componentTypeId,
        entryType: input.entryType,
        amount: input.amount,
        currencyCode: input.currencyCode,
        description: input.description,
        sourceReference: input.sourceReference,
      })
      .returning(entryCols);
    return toEntry(rows[0]!);
  }
  async getCostSummary(costSheetId: string) {
    const result = await this.db.db.execute(sql`
      SELECT e.component_type_id, ct.code as component_type,
        COALESCE(SUM(CASE WHEN e.entry_type = 'estimated' THEN e.amount ELSE 0 END), 0) as estimated,
        COALESCE(SUM(CASE WHEN e.entry_type = 'actual' THEN e.amount ELSE 0 END), 0) as actual
      FROM cost.entry e LEFT JOIN cost.component_type ct ON e.component_type_id = ct.id
      WHERE e.cost_sheet_id = ${costSheetId} GROUP BY e.component_type_id, ct.code ORDER BY ct.code`);
    return result.rows.map((r) => ({
      componentTypeId: r.component_type_id as string,
      componentType: (r.component_type as string | null) || '',
      estimated: String(r.estimated),
      actual: String(r.actual),
    }));
  }

  /* ═══ OVERHEAD POOLS ═══ */
  async listPools() {
    const rows = await this.db.db.select(poolCols).from(overheadPool);
    return rows.map(toPool);
  }
  async findPoolById(id: string) {
    const rows = await this.db.db
      .select(poolCols)
      .from(overheadPool)
      .where(eq(overheadPool.id, id))
      .limit(1);
    return rows[0] ? toPool(rows[0]) : null;
  }
  async findPoolByCode(code: string) {
    const rows = await this.db.db
      .select(poolCols)
      .from(overheadPool)
      .where(eq(overheadPool.code, code))
      .limit(1);
    return rows[0] ? toPool(rows[0]) : null;
  }
  async insertPool(input: CreateOverheadPoolInput & { id: string }) {
    const rows = await this.db.db
      .insert(overheadPool)
      .values({
        id: input.id,
        code: input.code,
        name: input.name,
        poolType: input.poolType,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        currencyCode: input.currencyCode ?? 'EGP',
        orgNodeId: input.orgNodeId,
      })
      .returning(poolCols);
    return toPool(rows[0]!);
  }
  async updatePoolTotal(poolId: string, newTotal: string) {
    await this.db.db
      .update(overheadPool)
      .set({ totalAmount: newTotal, updatedAt: new Date() })
      .where(eq(overheadPool.id, poolId));
  }
  async setPoolStatus(poolId: string, status: string) {
    const rows = await this.db.db
      .update(overheadPool)
      .set({ status, updatedAt: new Date() })
      .where(eq(overheadPool.id, poolId))
      .returning(poolCols);
    return rows[0] ? toPool(rows[0]) : null;
  }

  /* ═══ POOL ENTRIES ═══ */
  async insertPoolEntry(input: {
    id: string;
    poolId: string;
    accountId?: string;
    description: string;
    amount: string;
    sourceReference?: string;
  }) {
    const rows = await this.db.db
      .insert(overheadPoolEntry)
      .values({
        id: input.id,
        poolId: input.poolId,
        accountId: input.accountId ?? null,
        description: input.description,
        amount: input.amount,
        sourceReference: input.sourceReference ?? null,
      })
      .returning(poolEntryCols);
    return toPoolEntry(rows[0]!);
  }
  async getPoolEntries(poolId: string) {
    const rows = await this.db.db
      .select(poolEntryCols)
      .from(overheadPoolEntry)
      .where(eq(overheadPoolEntry.poolId, poolId));
    return rows.map(toPoolEntry);
  }
  async setPolicyJournal(policyId: string, journalEntryId: string): Promise<void> {
    await this.db.db
      .update(allocationPolicy)
      .set({ journalEntryId, updatedAt: new Date() })
      .where(eq(allocationPolicy.id, policyId));
  }
  async getPoolTotal(poolId: string): Promise<number> {
    const r = await this.db.db.execute(
      sql`SELECT COALESCE(SUM(amount::numeric), 0) as total FROM cost.overhead_pool_entry WHERE pool_id = ${poolId}`,
    );
    return Number(r.rows[0]?.total ?? 0);
  }

  /* ═══ ALLOCATION POLICIES ═══ */
  async listPolicies() {
    const rows = await this.db.db.select(policyCols).from(allocationPolicy);
    return rows.map(toPolicy);
  }
  async findPolicyById(id: string) {
    const rows = await this.db.db
      .select(policyCols)
      .from(allocationPolicy)
      .where(eq(allocationPolicy.id, id))
      .limit(1);
    return rows[0] ? toPolicy(rows[0]) : null;
  }
  async findPolicyByCode(code: string) {
    const rows = await this.db.db
      .select(policyCols)
      .from(allocationPolicy)
      .where(eq(allocationPolicy.code, code))
      .limit(1);
    return rows[0] ? toPolicy(rows[0]) : null;
  }
  async insertPolicy(input: CreateAllocationPolicyInput & { id: string }) {
    const rows = await this.db.db
      .insert(allocationPolicy)
      .values({
        id: input.id,
        code: input.code,
        name: input.name,
        poolId: input.poolId,
        allocationBase: input.allocationBase,
        percentage: input.percentage ?? '100',
        orgNodeId: input.orgNodeId,
        appliedAccountId: input.appliedAccountId ?? null,
      })
      .returning(policyCols);
    return toPolicy(rows[0]!);
  }
  async getTotalPercentageForPool(poolId: string): Promise<number> {
    const r = await this.db.db.execute(
      sql`SELECT COALESCE(SUM(percentage::numeric), 0) as total FROM cost.allocation_policy WHERE pool_id = ${poolId} AND is_active = 'yes'`,
    );
    return Number(r.rows[0]?.total ?? 0);
  }

  /* ═══ ALLOCATION RESULTS ═══ */
  async insertAllocationResult(input: {
    id: string;
    policyId: string;
    workOrderId: string | null;
    jobOrderReference: string | null;
    allocatedAmount: string;
    baseQuantity: string;
    baseRate: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const rows = await this.db.db
      .insert(allocationResult)
      .values({
        id: input.id,
        policyId: input.policyId,
        workOrderId: input.workOrderId,
        jobOrderReference: input.jobOrderReference,
        allocatedAmount: input.allocatedAmount,
        baseQuantity: input.baseQuantity,
        baseRate: input.baseRate,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
      })
      .returning(resultCols);
    return toResult(rows[0]!);
  }
  async getResultsByPolicy(policyId: string) {
    const rows = await this.db.db
      .select(resultCols)
      .from(allocationResult)
      .where(eq(allocationResult.policyId, policyId));
    return rows.map(toResult);
  }
  async deleteResultsByPolicy(policyId: string) {
    await this.db.db.delete(allocationResult).where(eq(allocationResult.policyId, policyId));
  }

  /* ═══ CROSS-SCHEMA BASE QUANTITY QUERIES (D2/D20) ═══ */

  async getUnitsProduced(periodStart: string, periodEnd: string) {
    const r = await this.db.db.execute(sql`
      SELECT id, qty_to_manufacture, job_order_reference
      FROM production_ops.work_order
      WHERE status IN ('completed','closed')
        AND actual_end_date >= ${periodStart}::timestamptz
        AND actual_end_date <= ${periodEnd}::timestamptz`);
    return r.rows.map((row) => ({
      workOrderId: row.id as string,
      jobOrderReference: row.job_order_reference as string | null,
      quantity: Number(row.qty_to_manufacture),
    }));
  }

  async getMachineHours(periodStart: string, periodEnd: string) {
    const r = await this.db.db.execute(sql`
      SELECT wo.id, wo.job_order_reference, COALESCE(SUM(tl.time_in_minutes),0)/60.0 as hrs
      FROM production_ops.work_order wo
      JOIN production_ops.production_step ps ON ps.work_order_id = wo.id
      JOIN production_ops.production_step_time_log tl ON tl.production_step_id = ps.id
      WHERE tl.from_time >= ${periodStart}::timestamptz AND tl.to_time <= ${periodEnd}::timestamptz
      GROUP BY wo.id, wo.job_order_reference HAVING COALESCE(SUM(tl.time_in_minutes),0) > 0`);
    return r.rows.map((row) => ({
      workOrderId: row.id as string,
      jobOrderReference: row.job_order_reference as string | null,
      quantity: Number(row.hrs),
    }));
  }

  async getLaborHours(periodStart: string, periodEnd: string) {
    const r = await this.db.db.execute(sql`
      SELECT wo.id, wo.job_order_reference, COALESCE(SUM(ps.actual_time_minutes),0)/60.0 as hrs
      FROM production_ops.work_order wo
      JOIN production_ops.production_step ps ON ps.work_order_id = wo.id
      WHERE wo.status IN ('completed','closed')
        AND wo.actual_end_date >= ${periodStart}::timestamptz AND wo.actual_end_date <= ${periodEnd}::timestamptz
        AND ps.actual_time_minutes IS NOT NULL
      GROUP BY wo.id, wo.job_order_reference HAVING COALESCE(SUM(ps.actual_time_minutes),0) > 0`);
    return r.rows.map((row) => ({
      workOrderId: row.id as string,
      jobOrderReference: row.job_order_reference as string | null,
      quantity: Number(row.hrs),
    }));
  }

  async getMaterialCosts(periodStart: string, periodEnd: string) {
    const r = await this.db.db.execute(sql`
      SELECT jcs.job_order_reference, COALESCE(SUM(e.amount::numeric),0) as cost
      FROM cost.entry e JOIN cost.job_cost_sheet jcs ON e.cost_sheet_id = jcs.id
      JOIN cost.component_type ct ON e.component_type_id = ct.id
      WHERE ct.code = 'material' AND e.entry_type = 'actual'
        AND e.recorded_at >= ${periodStart}::timestamptz AND e.recorded_at <= ${periodEnd}::timestamptz
      GROUP BY jcs.job_order_reference HAVING COALESCE(SUM(e.amount::numeric),0) > 0`);
    return r.rows.map((row) => ({
      workOrderId: null as string | null,
      jobOrderReference: row.job_order_reference as string,
      quantity: Number(row.cost),
    }));
  }

  async getLaborCosts(periodStart: string, periodEnd: string) {
    const r = await this.db.db.execute(sql`
      SELECT jcs.job_order_reference, COALESCE(SUM(e.amount::numeric),0) as cost
      FROM cost.entry e JOIN cost.job_cost_sheet jcs ON e.cost_sheet_id = jcs.id
      JOIN cost.component_type ct ON e.component_type_id = ct.id
      WHERE ct.code = 'labor' AND e.entry_type = 'actual'
        AND e.recorded_at >= ${periodStart}::timestamptz AND e.recorded_at <= ${periodEnd}::timestamptz
      GROUP BY jcs.job_order_reference HAVING COALESCE(SUM(e.amount::numeric),0) > 0`);
    return r.rows.map((row) => ({
      workOrderId: null as string | null,
      jobOrderReference: row.job_order_reference as string,
      quantity: Number(row.cost),
    }));
  }

  async getSalesRevenue(periodStart: string, periodEnd: string) {
    const r = await this.db.db.execute(sql`
      SELECT jo.job_order_number, COALESCE(jo.total_amount,0) as revenue
      FROM sales.job_order jo
      WHERE jo.order_date >= ${periodStart}::timestamptz AND jo.order_date <= ${periodEnd}::timestamptz
        AND jo.total_amount IS NOT NULL AND jo.total_amount > 0`);
    return r.rows.map((row) => ({
      workOrderId: null as string | null,
      jobOrderReference: row.job_order_number as string,
      quantity: Number(row.revenue),
    }));
  }
}
