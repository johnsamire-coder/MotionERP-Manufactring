export type SupplierStatus = 'active' | 'inactive' | 'archived';
export type CustomerStatus = 'lead' | 'active' | 'inactive' | 'archived';
export type InteractionType = 'visit' | 'call' | 'email' | 'note';

export interface SupplierRecord {
  id: string; code: string; name: string; contactPhone: string | null; contactEmail: string | null;
  orgNodeId: string; status: SupplierStatus;
  holdType: SupplierHoldType | null; holdReason: string | null; holdReleaseDate: string | null;
  createdAt: string; updatedAt: string;
}
/** all = every purchasing document; invoices / payments = only that document type (plan item 8). */
export type SupplierHoldType = 'all' | 'invoices' | 'payments';
/** The purchasing action being attempted, checked against the supplier's hold. */
export type SupplierAction = 'rfq' | 'quotation' | 'invoice' | 'payment';
export interface CreateSupplierInput {
  code: string; name: string; contactPhone?: string; contactEmail?: string; orgNodeId: string;
}

export interface CustomerRecord {
  id: string; code: string; name: string; contactPhone: string | null; contactEmail: string | null;
  orgNodeId: string; status: CustomerStatus; creditLimit: string | null; createdAt: string; updatedAt: string;
}
export interface CreateCustomerInput {
  code: string; name: string; contactPhone?: string; contactEmail?: string;
  orgNodeId: string; status?: CustomerStatus; creditLimit?: string | null;
}

export interface CustomerInteractionRecord {
  id: string; customerId: string; interactionType: InteractionType;
  interactionDate: string; note: string | null; createdAt: string;
}
export interface CreateInteractionInput {
  customerId: string; interactionType: InteractionType; interactionDate?: string; note?: string;
}
