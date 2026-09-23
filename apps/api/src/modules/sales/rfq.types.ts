export type RfqStatus = 'draft' | 'sent' | 'closed' | 'cancelled';
export type RfqSupplierStatus = 'pending' | 'received' | 'declined';

export interface RfqLineRecord { id: string; itemId: string; quantity: string; lineNumber: number; }
export interface RfqSupplierRecord {
  id: string; supplierId: string; status: RfqSupplierStatus; quotationId: string | null; respondedAt: string | null;
}
export interface RfqRecord {
  id: string; rfqNumber: string; orgNodeId: string | null; rfqDate: string; respondBy: string | null;
  status: RfqStatus; materialRequestReference: string | null; awardedSupplierId: string | null; note: string | null;
  createdAt: string; updatedAt: string;
  lines: RfqLineRecord[]; suppliers: RfqSupplierRecord[];
}

export interface CreateRfqInput {
  orgNodeId?: string;
  respondBy?: string;
  materialRequestReference?: string;
  note?: string;
  lines: Array<{ itemId: string; quantity: string }>;
  supplierIds: string[];
}

export interface RecordRfqResponseInput {
  /** quantity defaults to the RFQ quantity; more is allowed only within the over-order allowance (plan item 12). */
  lines: Array<{ itemId: string; unitPrice: string; quantity?: string }>;
  validUntil?: string;
  note?: string;
}

export interface RfqComparison {
  rfqId: string;
  suppliers: Array<{ supplierId: string; status: RfqSupplierStatus; quotationId: string | null; total: string | null }>;
  lines: Array<{
    itemId: string;
    quantity: string;
    offers: Array<{ supplierId: string; unitPrice: string; lineTotal: string; isLowest: boolean }>;
  }>;
  /** Cheapest supplier by total among those who answered every line; null if none. */
  lowestTotalSupplierId: string | null;
}
