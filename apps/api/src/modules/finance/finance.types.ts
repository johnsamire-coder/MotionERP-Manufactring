export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'credit_card';
export type CollectionStatus = 'pending' | 'completed' | 'cancelled';
export type RetentionStatus = 'active' | 'released' | 'expired' | 'cancelled';
export type PurchaseInvoiceStatus = 'draft' | 'posted' | 'cancelled';
export type SalesInvoiceStatus = 'draft' | 'posted' | 'cancelled';
export type PaymentStatus = 'draft' | 'posted' | 'cancelled';
export type CreditDebitNoteType = 'credit_note' | 'debit_note';
export type CreditDebitNoteStatus = 'draft' | 'posted' | 'cancelled';
export type BankTransferStatus = 'draft' | 'posted' | 'cancelled';
export type BankReconciliationStatus = 'draft' | 'reconciled' | 'cancelled';

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

// --- Credit & Debit Notes Types ---
export interface CreditDebitNoteLineRecord {
  id: string;
  noteId: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
  createdAt: string;
}

export interface CreditDebitNoteRecord {
  id: string;
  noteNumber: string;
  noteType: CreditDebitNoteType;
  orgNodeId: string;
  partyType: 'customer' | 'supplier';
  partyId: string;
  originalInvoiceNumber: string | null;
  salesInvoiceId: string | null;
  purchaseInvoiceId: string | null;
  postingDate: string;
  netAmount: string;
  taxAmount: string;
  grandTotal: string;
  reason: string | null;
  status: CreditDebitNoteStatus;
  createdAt: string;
  updatedAt: string;
  lines: CreditDebitNoteLineRecord[];
}

export interface CreateCreditDebitNoteLineInput {
  itemId: string;
  quantity: string;
  unitPrice: string;
  taxRate?: string;
}

export interface CreateCreditDebitNoteInput {
  noteType: CreditDebitNoteType;
  orgNodeId: string;
  partyType: 'customer' | 'supplier';
  partyId: string;
  originalInvoiceNumber?: string;
  salesInvoiceId?: string;
  purchaseInvoiceId?: string;
  postingDate?: string;
  reason?: string;
  lines: CreateCreditDebitNoteLineInput[];
}

// --- Bank Transfer Types ---
export interface BankTransferRecord {
  id: string;
  transferNumber: string;
  orgNodeId: string;
  fromAccountId: string;
  toAccountId: string;
  transferDate: string;
  amount: string;
  referenceNumber: string | null;
  notes: string | null;
  status: BankTransferStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankTransferInput {
  orgNodeId: string;
  fromAccountId: string;
  toAccountId: string;
  transferDate?: string;
  amount: string;
  referenceNumber?: string;
  notes?: string;
}

// --- Bank Reconciliation Types ---
export interface BankReconciliationRecord {
  id: string;
  reconciliationNumber: string;
  orgNodeId: string;
  bankAccountId: string;
  statementDate: string;
  statementBalance: string;
  clearedBalance: string;
  differenceAmount: string;
  status: BankReconciliationStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankReconciliationInput {
  orgNodeId: string;
  bankAccountId: string;
  statementDate: string;
  statementBalance: string;
  notes?: string;
}