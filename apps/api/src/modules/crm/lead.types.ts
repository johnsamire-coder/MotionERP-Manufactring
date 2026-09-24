export type LeadStatus = 'new' | 'contacted' | 'interested' | 'prospect' | 'converted' | 'lost' | 'do_not_contact';
export type ProspectStatus = 'open' | 'converted' | 'lost';
export type LeadActivityType = 'call' | 'visit' | 'email' | 'note';

export interface LeadActivityRecord { id: string; activityType: LeadActivityType; activityDate: string; note: string | null; }

export interface LeadRecord {
  id: string; leadNumber: string; personName: string; companyName: string | null; phone: string | null; email: string | null;
  source: string | null; orgNodeId: string; status: LeadStatus; prospectId: string | null; customerId: string | null;
  lostReason: string | null; lastContactedAt: string | null; createdAt: string; updatedAt: string;
  activities: LeadActivityRecord[];
}

export interface ProspectRecord {
  id: string; prospectNumber: string; companyName: string; industry: string | null; orgNodeId: string;
  status: ProspectStatus; customerId: string | null; note: string | null; createdAt: string; updatedAt: string;
  leadIds: string[];
}

export interface CreateLeadInput {
  personName: string; companyName?: string; phone?: string; email?: string; source?: string; orgNodeId: string;
}
export interface CreateProspectInput { companyName: string; industry?: string; orgNodeId: string; note?: string; leadIds: string[]; }
