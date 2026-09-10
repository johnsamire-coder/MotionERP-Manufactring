export type QuotationDirection = 'outgoing' | 'incoming';
export type QuotationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';

export interface QuotationLineRecord {
  id: string; quotationId: string; itemId: string; quantity: string; unitPrice: string; lineNumber: number;
}

export interface QuotationRecord {
  id: string; quotationNumber: string; direction: QuotationDirection;
  customerId: string | null; supplierId: string | null;
  quotationDate: string; validUntil: string | null; status: QuotationStatus;
  currency: string; customerPoReference: string | null; note: string | null;
  createdAt: string; updatedAt: string; lines: QuotationLineRecord[];
}

export interface CreateQuotationLineInput { itemId: string; quantity: string; unitPrice: string; }

export interface CreateQuotationInput {
  direction: QuotationDirection;
  customerId?: string;
  supplierId?: string;
  quotationDate?: string;
  validUntil?: string;
  currency?: string;
  note?: string;
  lines: CreateQuotationLineInput[];
}

export type JobOrderSource = 'quotation' | 'internal';
export type JobOrderStatus = 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';

export interface JobOrderRecord {
  id: string; jobOrderNumber: string; source: JobOrderSource;
  quotationReference: string | null; customerId: string | null;
  status: JobOrderStatus; financialReviewPassed: boolean; note: string | null;
  createdAt: string; updatedAt: string;
}

export interface CreateJobOrderInput {
  source: JobOrderSource;
  quotationReference?: string;
  customerId?: string;
  note?: string;
}
