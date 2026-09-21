export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'credit_card';
export type CollectionStatus = 'pending' | 'completed' | 'cancelled';
export type RetentionStatus = 'active' | 'released' | 'expired' | 'cancelled';
export type PurchaseInvoiceStatus = 'draft' | 'posted' | 'cancelled';
export type SalesInvoiceStatus = 'draft' | 'posted' | 'cancelled';
export type PaymentStatus = 'draft' | 'posted' | 'cancelled';

export interface CollectionRecord {
  id: string;
  jobOrderReference: string;
  orgNodeId: string | null;
  collectionNumber: string;
  collectionDate: string;
  amount: string;
  currencyCode: string;
  paymentMethod: PaymentMethod;
  receivedInAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  status: CollectionStatus;
}

export interface CreateCollectionInput {
  jobOrderReference: string;
  collectionDate?: string;
  amount: string;
  currencyCode?: string;
  paymentMethod: PaymentMethod;
  receivedInAccountId?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface RetentionRecord {
  id: string;
  jobOrderReference: string;
  orgNodeId: string | null;
  retentionNumber: string;
  originalAmount: string;
  releasedAmount: string;
  currencyCode: string;
  startDate: string;
  releaseDate: string | null;
  dueDate: string;
  status: RetentionStatus;
  notes: string | null;
}

export interface CreateRetentionInput {
  jobOrderReference: string;
  originalAmount: string;
  currencyCode?: string;
  startDate?: string;
  dueDate: string;
  notes?: string;
}

// --- Purchase Invoice Types ---
export interface PurchaseInvoiceLineRecord {
  id: string;
  purchaseInvoiceId: string;
  itemId: string;
  quantity: string;
  unitCost: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
  purchaseReceiptId: string | null;
  createdAt: string;
}

export interface PurchaseInvoiceRecord {
  id: string;
  invoiceNumber: string;
  systemNumber: string;
  orgNodeId: string;
  supplierId: string;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  exchangeRate: string;
  netAmount: string;
  taxAmount: string;
  grandTotal: string;
  status: PurchaseInvoiceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseInvoiceLineRecord[];
}

export interface CreatePurchaseInvoiceLineInput {
  itemId: string;
  quantity: string;
  unitCost: string;
  taxRate?: string;
  purchaseReceiptId?: string;
}

export interface CreatePurchaseInvoiceInput {
  orgNodeId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currencyCode?: string;
  exchangeRate?: string;
  notes?: string;
  lines: CreatePurchaseInvoiceLineInput[];
}

// --- Sales Invoice Types ---
export interface SalesInvoiceLineRecord {
  id: string;
  salesInvoiceId: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
  deliveryOrderId: string | null;
  createdAt: string;
}

export interface SalesInvoiceRecord {
  id: string;
  invoiceNumber: string;
  orgNodeId: string;
  customerId: string;
  jobOrderReference: string | null;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  exchangeRate: string;
  netAmount: string;
  taxAmount: string;
  grandTotal: string;
  status: SalesInvoiceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SalesInvoiceLineRecord[];
}

export interface CreateSalesInvoiceLineInput {
  itemId: string;
  quantity: string;
  unitPrice: string;
  taxRate?: string;
  deliveryOrderId?: string;
}

export interface CreateSalesInvoiceInput {
  orgNodeId: string;
  customerId: string;
  jobOrderReference?: string;
  invoiceDate: string;
  dueDate: string;
  currencyCode?: string;
  exchangeRate?: string;
  notes?: string;
  lines: CreateSalesInvoiceLineInput[];
}

// --- Payment Types ---
export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  orgNodeId: string;
  supplierId: string | null;
  purchaseInvoiceId: string | null;
  paymentDate: string;
  amount: string;
  currencyCode: string;
  paymentMethod: PaymentMethod;
  paidFromAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentInput {
  orgNodeId: string;
  supplierId?: string;
  purchaseInvoiceId?: string;
  paymentDate?: string;
  amount: string;
  currencyCode?: string;
  paymentMethod: PaymentMethod;
  paidFromAccountId: string;
  referenceNumber?: string;
  notes?: string;
}