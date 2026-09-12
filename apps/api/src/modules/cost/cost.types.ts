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
