export type CollectionStatus = 'pending' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'credit_card';
export type RetentionStatus = 'active' | 'released' | 'expired' | 'cancelled';

export interface CollectionRecord {
  id: string; jobOrderReference: string; orgNodeId: string | null; collectionNumber: string; collectionDate: string;
  amount: string; currencyCode: string; paymentMethod: PaymentMethod; referenceNumber: string | null;
  notes: string | null; status: CollectionStatus;
}
export interface CreateCollectionInput {
  jobOrderReference: string; collectionDate?: string; amount: string; currencyCode?: string;
  paymentMethod: PaymentMethod; referenceNumber?: string; notes?: string;
}

export interface RetentionRecord {
  id: string; jobOrderReference: string; orgNodeId: string | null; retentionNumber: string; originalAmount: string;
  releasedAmount: string; currencyCode: string; startDate: string; releaseDate: string | null;
  dueDate: string; status: RetentionStatus; notes: string | null;
}
export interface CreateRetentionInput {
  jobOrderReference: string; originalAmount: string; currencyCode?: string;
  startDate?: string; dueDate: string; notes?: string;
}
