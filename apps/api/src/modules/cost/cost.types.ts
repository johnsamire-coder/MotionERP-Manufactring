export type CostEntryType = 'estimated' | 'actual';
export type JobCostSheetStatus = 'draft' | 'active' | 'closed';

export interface CostComponentTypeRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
}
export interface CreateCostComponentTypeInput {
  code: string;
  name: string;
  description?: string;
}

export interface JobCostSheetRecord {
  id: string;
  jobOrderReference: string;
  orgNodeId: string | null;
  currencyCode: string;
  status: JobCostSheetStatus;
}
export interface CreateJobCostSheetInput {
  jobOrderReference: string;
  currencyCode?: string;
}

export interface CostEntryRecord {
  id: string;
  costSheetId: string;
  componentTypeId: string;
  entryType: CostEntryType;
  amount: string;
  currencyCode: string;
  description: string | null;
  sourceReference: string | null;
}
export interface CreateCostEntryInput {
  costSheetId: string;
  componentTypeId: string;
  entryType: CostEntryType;
  amount: string;
  currencyCode: string;
  description?: string;
  sourceReference?: string;
}

export interface CostSummary {
  jobOrderReference: string;
  currencyCode: string;
  estimatedTotal: string;
  actualTotal: string;
  variance: string;
  margin: string;
  entries: Array<{
    componentType: string;
    estimated: string;
    actual: string;
    variance: string;
  }>;
}

/* ═══ OVERHEAD ALLOCATION TYPES ═══ */

export type PoolType = 'manufacturing_overhead' | 'administrative' | 'selling_marketing';
export type PoolStatus = 'draft' | 'active' | 'allocated' | 'closed';
export type AllocationBase =
  | 'units_produced'
  | 'direct_labor_hours'
  | 'direct_labor_cost'
  | 'machine_hours'
  | 'direct_material_cost'
  | 'sales_revenue';

export interface OverheadPoolRecord {
  id: string;
  code: string;
  name: string;
  poolType: PoolType;
  periodStart: string;
  periodEnd: string;
  totalAmount: string;
  currencyCode: string;
  status: PoolStatus;
  orgNodeId: string | null;
}
export interface CreateOverheadPoolInput {
  code: string;
  name: string;
  poolType: PoolType;
  periodStart: string;
  periodEnd: string;
  currencyCode?: string;
  orgNodeId: string;
}
export interface AddPoolEntryInput {
  accountId?: string;
  description: string;
  amount: string;
  sourceReference?: string;
}
export interface OverheadPoolEntryRecord {
  id: string;
  poolId: string;
  accountId: string | null;
  description: string;
  amount: string;
  sourceReference: string | null;
  recordedAt: string;
}

export interface AllocationPolicyRecord {
  id: string;
  code: string;
  name: string;
  poolId: string;
  allocationBase: AllocationBase;
  percentage: string;
  isActive: string;
  orgNodeId: string | null;
  appliedAccountId: string | null;
  journalEntryId: string | null;
}
export interface CreateAllocationPolicyInput {
  code: string;
  name: string;
  poolId: string;
  allocationBase: AllocationBase;
  percentage?: string;
  orgNodeId: string;
  appliedAccountId?: string;
}

export interface AllocationResultRecord {
  id: string;
  policyId: string;
  workOrderId: string | null;
  jobOrderReference: string | null;
  allocatedAmount: string;
  baseQuantity: string;
  baseRate: string;
  periodStart: string;
  periodEnd: string;
  allocatedAt: string;
}

export interface AllocationExecutionSummary {
  policyId: string;
  policyName: string;
  poolName: string;
  allocationBase: AllocationBase;
  totalPoolAmount: string;
  percentageApplied: string;
  amountToAllocate: string;
  totalBaseQuantity: string;
  baseRate: string;
  workOrdersAffected: number;
  results: AllocationResultRecord[];
  /** Posted journal (Dr WIP / Cr applied overhead) when the policy has an applied account. */
  journalEntryId: string | null;
}
