export type SupplierStatus = 'active' | 'inactive' | 'archived';
export type CustomerStatus = 'lead' | 'active' | 'inactive' | 'archived';
export type InteractionType = 'visit' | 'call' | 'email' | 'note';

export interface SupplierRecord {
  id: string; code: string; name: string; contactPhone: string | null; contactEmail: string | null;
  orgNodeId: string; status: SupplierStatus; createdAt: string; updatedAt: string;
}
export interface CreateSupplierInput {
  code: string; name: string; contactPhone?: string; contactEmail?: string; orgNodeId: string;
}

export interface CustomerRecord {
  id: string; code: string; name: string; contactPhone: string | null; contactEmail: string | null;
  orgNodeId: string; status: CustomerStatus; createdAt: string; updatedAt: string;
}
export interface CreateCustomerInput {
  code: string; name: string; contactPhone?: string; contactEmail?: string;
  orgNodeId: string; status?: CustomerStatus;
}

export interface CustomerInteractionRecord {
  id: string; customerId: string; interactionType: InteractionType;
  interactionDate: string; note: string | null; createdAt: string;
}
export interface CreateInteractionInput {
  customerId: string; interactionType: InteractionType; interactionDate?: string; note?: string;
}
