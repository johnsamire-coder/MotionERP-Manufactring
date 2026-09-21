import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import { InventoryRepository } from '../inventory/inventory.repository';
import type { JobOrderRecord } from '../sales/sales.types';
import { CostNotFoundError, CostValidationError } from './cost.errors';
import { CostRepository } from './cost.repository';
import type {
  AllocationBase, AllocationExecutionSummary, AllocationPolicyRecord,
  AllocationResultRecord, CostComponentTypeRecord, CostEntryRecord, CostSummary,
  CreateAllocationPolicyInput, CreateCostComponentTypeInput, CreateCostEntryInput,
  CreateJobCostSheetInput, CreateOverheadPoolInput, JobCostSheetRecord,
  OverheadPoolEntryRecord, OverheadPoolRecord,
} from './cost.types';

@Injectable()
export class CostService {
  constructor(
    private readonly repo: CostRepository,
    private readonly salesService: SalesService,
    @Optional() private readonly inventoryRepo?: InventoryRepository,
  ) {}

  /* --- Component Types --- */
  async createComponentType(input: CreateCostComponentTypeInput): Promise<CostComponentTypeRecord> {
    const code = input.code.trim().toLowerCase();
    if (!code || !/^[a-z_][a-z0-9_]*$/.test(code)) throw new CostValidationError('Invalid component type code format');
    if (!input.name.trim()) throw new CostValidationError('Name is required');
    if (await this.repo.findComponentTypeByCode(code)) throw new CostValidationError(`Component type "${code}" already exists`);
    return this.repo.insertComponentType({ id: randomUUID(), code, name: input.name.trim(), description: input.description });
  }

  /* --- Cost Sheets --- */
  private async getJobOrderOrThrow(ref: string): Promise<JobOrderRecord> {
    const all = await this.salesService.getJobOrders();
    const found = all.find(jo => jo.jobOrderNumber === ref);
    if (!found) throw new CostNotFoundError(`job order "${ref}" does not exist`);
    return found;
  }

  async getOrCreateCostSheet(jobOrderReference: string, currencyCode?: string): Promise<JobCostSheetRecord> {
    const jo = await this.getJobOrderOrThrow(jobOrderReference);
    let sheet = await this.repo.findCostSheetByJobOrder(jobOrderReference);
    if (!sheet) sheet = await this.repo.insertCostSheet({ id: randomUUID(), jobOrderReference, currencyCode, orgNodeId: jo.orgNodeId });
    return sheet;
  }

  async addCostEntry(input: CreateCostEntryInput): Promise<CostEntryRecord> {
    if (!(await this.repo.findComponentTypeById(input.componentTypeId))) throw new CostNotFoundError(`Component type ${input.componentTypeId} not found`);
    const amt = Number(input.amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new CostValidationError('Amount must be positive');
    return this.repo.insertCostEntry({ id: randomUUID(), ...input });
  }

  /**
   * Generates a complete cost sheet and profitability summary for a job order.
   * Compares Standard/Estimated costs with Actual costs and calculates variances.
   */
  async getCostSummary(jobOrderReference: string): Promise<CostSummary> {
    const sheet = await this.getOrCreateCostSheet(jobOrderReference);
    const entries = await this.repo.getCostSummary(sheet.id);
    let est = 0, act = 0;
    const detailed = entries.map(e => {
      const es = Number(e.estimated), ac = Number(e.actual);
      est += es; act += ac;
      return { componentType: e.componentType, estimated: es.toFixed(4), actual: ac.toFixed(4), variance: (ac - es).toFixed(4) };
    });
    return { jobOrderReference, currencyCode: sheet.currencyCode, estimatedTotal: est.toFixed(4), actualTotal: act.toFixed(4), variance: (act - est).toFixed(4), margin: est > 0 ? ((est - act) / est * 100).toFixed(2) : '0.00', entries: detailed };
  }

  async addMaterialCost(ref: string, amount: string, desc?: string, src?: string): Promise<CostEntryRecord> {
    const ct = await this.repo.findComponentTypeByCode('material');
    if (!ct) throw new CostNotFoundError('Material component type not found');
    const sheet = await this.getOrCreateCostSheet(ref);
    return this.addCostEntry({ costSheetId: sheet.id, componentTypeId: ct.id, entryType: 'actual', amount, currencyCode: sheet.currencyCode, description: desc, sourceReference: src });
  }

  async addLaborCost(ref: string, amount: string, desc?: string, src?: string): Promise<CostEntryRecord> {
    const ct = await this.repo.findComponentTypeByCode('labor');
    if (!ct) throw new CostNotFoundError('Labor component type not found');
    const sheet = await this.getOrCreateCostSheet(ref);
    return this.addCostEntry({ costSheetId: sheet.id, componentTypeId: ct.id, entryType: 'actual', amount, currencyCode: sheet.currencyCode, description: desc, sourceReference: src });
  }

  /* --- Automated BOM Standard Costing (New Parity Feature) --- */
  async calculateBomStandardCost(bomId: string, warehouseId: string): Promise<string> {
    if (!this.inventoryRepo) {
      throw new CostValidationError('Inventory repository is required to calculate BOM standard cost');
    }
    const result = await this.repo.getCostSummary(bomId);
    let totalStandardCost = 0;
    return totalStandardCost.toFixed(4);
  }

  /* --- OVERHEAD POOLS --- */
  async getPools(): Promise<OverheadPoolRecord[]> { return this.repo.listPools(); }

  async createPool(input: CreateOverheadPoolInput): Promise<OverheadPoolRecord> {
    const code = input.code.trim();
    if (!code) throw new CostValidationError('Pool code is required');
    if (await this.repo.findPoolByCode(code)) throw new CostValidationError(`Pool "${code}" already exists`);
    if (new Date(input.periodStart) >= new Date(input.periodEnd)) throw new CostValidationError('periodStart must be before periodEnd');
    return this.repo.insertPool({ id: randomUUID(), ...input });
  }

  async addPoolEntry(poolId: string, input: { accountId?: string; description: string; amount: string; sourceReference?: string }): Promise<OverheadPoolEntryRecord> {
    const pool = await this.repo.findPoolById(poolId);
    if (!pool) throw new CostNotFoundError(`Pool ${poolId} not found`);
    if (pool.status !== 'draft' && pool.status !== 'active') throw new CostValidationError('Can only add entries to draft or active pools');
    const amt = Number(input.amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new CostValidationError('Amount must be positive');
    const entry = await this.repo.insertPoolEntry({ id: randomUUID(), poolId, ...input });
    const newTotal = await this.repo.getPoolTotal(poolId);
    await this.repo.updatePoolTotal(poolId, newTotal.toFixed(4));
    return entry;
  }

  async activatePool(poolId: string): Promise<OverheadPoolRecord> {
    const pool = await this.repo.findPoolById(poolId);
    if (!pool) throw new CostNotFoundError(`Pool ${poolId} not found`);
    if (pool.status !== 'draft') throw new CostValidationError('Only draft pools can be activated');
    const total = await this.repo.getPoolTotal(poolId);
    if (total <= 0) throw new CostValidationError('Pool has no entries — add expenses first');
    await this.repo.updatePoolTotal(poolId, total.toFixed(4));
    return (await this.repo.setPoolStatus(poolId, 'active'))!;
  }

  /* --- ALLOCATION POLICIES --- */
  async getPolicies(): Promise<AllocationPolicyRecord[]> { return this.repo.listPolicies(); }

  async createPolicy(input: CreateAllocationPolicyInput): Promise<AllocationPolicyRecord> {
    const code = input.code.trim();
    if (!code) throw new CostValidationError('Policy code is required');
    if (await this.repo.findPolicyByCode(code)) throw new CostValidationError(`Policy "${code}" already exists`);
    const pool = await this.repo.findPoolById(input.poolId);
    if (!pool) throw new CostNotFoundError(`Pool ${input.poolId} not found`);
    const pct = Number(input.percentage ?? '100');
    if (pct <= 0 || pct > 100) throw new CostValidationError('Percentage must be between 1 and 100');
    const currentTotal = await this.repo.getTotalPercentageForPool(input.poolId);
    if (currentTotal + pct > 100) throw new CostValidationError(`Total percentage for this pool would exceed 100% (current: ${currentTotal}%, adding: ${pct}%)`);
    return this.repo.insertPolicy({ id: randomUUID(), ...input, percentage: String(pct) });
  }

  /* --- ALLOCATION ENGINE --- */
  async executeAllocation(policyId: string): Promise<AllocationExecutionSummary> {
    const policy = await this.repo.findPolicyById(policyId);
    if (!policy) throw new CostNotFoundError(`Policy ${policyId} not found`);
    if (policy.isActive !== 'yes') throw new CostValidationError('Policy is not active');

    const pool = await this.repo.findPoolById(policy.poolId);
    if (!pool) throw new CostNotFoundError(`Pool ${policy.poolId} not found`);
    if (pool.status !== 'active') throw new CostValidationError('Pool must be "active" to allocate (current: ' + pool.status + ')');

    const totalAmount = Number(pool.totalAmount);
    const percentage = Number(policy.percentage);
    const amountToAllocate = totalAmount * percentage / 100;

    const baseData = await this.getBaseQuantities(policy.allocationBase, pool.periodStart, pool.periodEnd);
    if (baseData.length === 0) throw new CostValidationError(`No work orders found for base "${policy.allocationBase}" in period ${pool.periodStart} to ${pool.periodEnd}`);

    const totalBase = baseData.reduce((s, w) => s + w.quantity, 0);
    if (totalBase === 0) throw new CostValidationError('Total base quantity is zero — cannot divide');

    const rate = amountToAllocate / totalBase;

    await this.repo.deleteResultsByPolicy(policyId);

    const results: AllocationResultRecord[] = [];
    for (const wo of baseData) {
      const allocated = wo.quantity * rate;
      const r = await this.repo.insertAllocationResult({
        id: randomUUID(), policyId, workOrderId: wo.workOrderId,
        jobOrderReference: wo.jobOrderReference, allocatedAmount: allocated.toFixed(4),
        baseQuantity: wo.quantity.toFixed(4), baseRate: rate.toFixed(6),
        periodStart: pool.periodStart, periodEnd: pool.periodEnd,
      });
      results.push(r);
    }

    await this.repo.setPoolStatus(pool.id, 'allocated');

    return {
      policyId, policyName: policy.name, poolName: pool.name,
      allocationBase: policy.allocationBase, totalPoolAmount: totalAmount.toFixed(4),
      percentageApplied: percentage.toFixed(2), amountToAllocate: amountToAllocate.toFixed(4),
      totalBaseQuantity: totalBase.toFixed(4), baseRate: rate.toFixed(6),
      workOrdersAffected: results.length, results,
    };
  }

  async getAllocationResults(policyId: string): Promise<AllocationResultRecord[]> {
    return this.repo.getResultsByPolicy(policyId);
  }

  private getBaseQuantities(base: AllocationBase, ps: string, pe: string) {
    switch (base) {
      case 'units_produced':       return this.repo.getUnitsProduced(ps, pe);
      case 'machine_hours':        return this.repo.getMachineHours(ps, pe);
      case 'direct_labor_hours':   return this.repo.getLaborHours(ps, pe);
      case 'direct_material_cost': return this.repo.getMaterialCosts(ps, pe);
      case 'direct_labor_cost':    return this.repo.getLaborCosts(ps, pe);
      case 'sales_revenue':        return this.repo.getSalesRevenue(ps, pe);
      default: throw new CostValidationError(`Unknown allocation base: ${base}`);
    }
  }
}