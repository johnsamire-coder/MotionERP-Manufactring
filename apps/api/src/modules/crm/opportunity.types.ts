export type OpportunityStage = 'open' | 'qualified' | 'quoted' | 'won' | 'lost';
export interface OpportunityItemRecord {
  id: string;
  itemId: string;
  quantity: string;
  expectedRate: string | null;
}
export interface OpportunityRecord {
  id: string;
  opportunityNumber: string;
  customerId: string;
  title: string;
  source: string | null;
  expectedAmount: string | null;
  probability: number;
  expectedCloseDate: string | null;
  stage: OpportunityStage;
  lostReason: string | null;
  quotationId: string | null;
  createdAt: string;
  updatedAt: string;
  items: OpportunityItemRecord[];
}
export interface CreateOpportunityInput {
  customerId: string;
  title: string;
  source?: string;
  expectedAmount?: string;
  probability?: number;
  expectedCloseDate?: string;
  items?: Array<{ itemId: string; quantity: string; expectedRate?: string }>;
}
