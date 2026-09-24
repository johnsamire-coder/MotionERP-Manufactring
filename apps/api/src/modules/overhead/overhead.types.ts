export type OverheadCategory = 'manufacturing' | 'administrative' | 'selling' | 'distribution';
export type AllocationBase =
  | 'units_produced'
  | 'direct_labor_hours'
  | 'direct_labor_cost'
  | 'machine_hours'
  | 'direct_material_cost'
  | 'sales_revenue';
export type OverheadPoolStatus = 'draft' | 'allocated' | 'closed';

export interface OverheadPoolRecord {
  id: string;
  orgNodeId: string;
  poolCode: string;
  poolName: string;
  category: OverheadCategory;
  periodYear: number;
  periodMonth: number;
  totalAmount: string;
  currencyCode: string;
  status: OverheadPoolStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOverheadPoolInput {
  orgNodeId: string;
  poolCode: string;
  poolName: string;
  category: OverheadCategory;
  periodYear: number;
  periodMonth: number;
  totalAmount: string;
  currencyCode?: string;
}

export interface AllocationPolicyRecord {
  id: string;
  orgNodeId: string;
  poolId: string;
  allocationBase: AllocationBase;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAllocationPolicyInput {
  orgNodeId: string;
  poolId: string;
  allocationBase: AllocationBase;
  description?: string;
}

export interface AllocationResultRecord {
  id: string;
  poolId: string;
  jobOrderReference: string;
  allocatedAmount: string;
  allocationRate: string;
  baseValue: string;
  allocationBase: string;
  periodYear: number;
  periodMonth: number;
  createdAt: string;
}

export interface RunAllocationInput {
  poolId: string;
  periodYear: number;
  periodMonth: number;
}
