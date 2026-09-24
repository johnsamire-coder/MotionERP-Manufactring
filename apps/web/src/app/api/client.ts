const API_BASE_URL = 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

// ==================== Login session (plan item 5.0) ====================
// The login token is kept per browser. Storage can be unavailable (private mode), so every
// access is guarded and the app simply behaves as "not logged in" then.
const TOKEN_KEY = 'motion-erp.access-token';
/** Fired on window when the API answers 401, so the shell can show the login dialog. */
export const AUTH_REQUIRED_EVENT = 'motion-erp:auth-required';

export function getAccessToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the session lasts until reload */
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (response.status === 401) {
    setAccessToken(null);
    window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body.message ?? 'Request failed');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T = void>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};

export interface SessionUser {
  id: string;
  name: string;
  role: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{
      user: { id: string; username: string };
      accessToken: string;
      expiresInSeconds: number;
    }>('/auth/login', { username, password }),
  me: () => api.get<{ user: SessionUser }>('/auth/me'),
};

// ==================== Finance & Accounting API Helpers ====================
// Response shapes mirror the API's finance.types / accounting.types.

export interface PurchaseInvoiceLine {
  id: string;
  itemId: string;
  quantity: string;
  unitCost: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
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
  netAmount: string;
  taxAmount: string;
  grandTotal: string;
  status: string;
  notes: string | null;
  lines: PurchaseInvoiceLine[];
}
export interface CreatePurchaseInvoiceInput {
  orgNodeId: string;
  supplierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currencyCode?: string;
  notes?: string;
  lines: Array<{ itemId: string; quantity: string; unitCost: string; taxRate?: string }>;
}
export interface SalesInvoiceLine {
  id: string;
  itemId: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  totalAmount: string;
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
  netAmount: string;
  taxAmount: string;
  grandTotal: string;
  status: string;
  notes: string | null;
  lines: SalesInvoiceLine[];
}
export interface CreateSalesInvoiceInput {
  orgNodeId: string;
  customerId: string;
  jobOrderReference?: string;
  invoiceDate: string;
  dueDate: string;
  currencyCode?: string;
  notes?: string;
  lines: Array<{ itemId: string; quantity: string; unitPrice: string; taxRate?: string }>;
}
export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  orgNodeId: string;
  supplierId: string | null;
  purchaseInvoiceId: string | null;
  paymentDate: string;
  amount: string;
  currencyCode: string;
  paymentMethod: string;
  paidFromAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  status: string;
}
export interface CreatePaymentInput {
  orgNodeId: string;
  supplierId?: string;
  purchaseInvoiceId?: string;
  paymentDate?: string;
  amount: string;
  paymentMethod: string;
  paidFromAccountId: string;
  referenceNumber?: string;
  notes?: string;
}
export interface CollectionRecord {
  id: string;
  jobOrderReference: string;
  collectionNumber: string;
  collectionDate: string;
  amount: string;
  currencyCode: string;
  paymentMethod: string;
  status: string;
}
export interface CreateCollectionInput {
  jobOrderReference: string;
  collectionDate?: string;
  amount: string;
  paymentMethod: string;
  receivedInAccountId?: string;
  referenceNumber?: string;
  notes?: string;
}
export interface JournalLineRecord {
  id: string;
  accountId: string;
  debitAmount: string;
  creditAmount: string;
  description: string | null;
  partyType?: string | null;
  partyId?: string | null;
}
export interface JournalEntryRecord {
  id: string;
  entryNumber: string;
  orgNodeId: string | null;
  reference: string | null;
  description: string;
  entryDate: string;
  postedAt: string | null;
  status: string;
  voucherType?: string;
  lines: JournalLineRecord[];
}
export interface TrialBalanceReport {
  orgNodeId: string;
  totalDebit: string;
  totalCredit: string;
  isBalanced: boolean;
  rows: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
    balance: string;
  }>;
}
export interface ProfitAndLossReport {
  orgNodeId: string;
  startDate?: string;
  endDate?: string;
  totalRevenue: string;
  totalCogs: string;
  grossProfit: string;
  totalExpenses: string;
  netProfit: string;
  revenueDetails: Array<{ accountName: string; balance: string }>;
  expenseDetails: Array<{ accountName: string; balance: string }>;
}
export interface BalanceSheetReport {
  orgNodeId: string;
  date: string;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
  isBalanced: boolean;
  assets: Array<{ accountName: string; balance: string }>;
  liabilities: Array<{ accountName: string; balance: string }>;
  equity: Array<{ accountName: string; balance: string }>;
}
export interface PartnerLedgerReport {
  partyType: 'customer' | 'supplier';
  partyId: string;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  rows: Array<{
    journalEntryId: string;
    entryNumber: string;
    entryDate: string;
    description: string;
    debit: string;
    credit: string;
    runningBalance: string;
  }>;
}

export const financeApi = {
  getPurchaseInvoices: (orgNodeId?: string) =>
    api.get<{ purchaseInvoices: PurchaseInvoiceRecord[] }>(
      `/finance/purchase-invoices${orgNodeId ? `?orgNodeId=${orgNodeId}` : ''}`,
    ),
  createPurchaseInvoice: (data: CreatePurchaseInvoiceInput) =>
    api.post<{ purchaseInvoice: PurchaseInvoiceRecord }>('/finance/purchase-invoices', data),
  postPurchaseInvoice: (id: string) =>
    api.post<{ purchaseInvoice: PurchaseInvoiceRecord }>(
      `/finance/purchase-invoices/${id}/post`,
      {},
    ),

  getSalesInvoices: (orgNodeId?: string) =>
    api.get<{ salesInvoices: SalesInvoiceRecord[] }>(
      `/finance/sales-invoices${orgNodeId ? `?orgNodeId=${orgNodeId}` : ''}`,
    ),
  createSalesInvoice: (data: CreateSalesInvoiceInput) =>
    api.post<{ salesInvoice: SalesInvoiceRecord }>('/finance/sales-invoices', data),
  postSalesInvoice: (id: string) =>
    api.post<{ salesInvoice: SalesInvoiceRecord }>(`/finance/sales-invoices/${id}/post`, {}),

  getPayments: (orgNodeId?: string) =>
    api.get<{ payments: PaymentRecord[] }>(
      `/finance/payments${orgNodeId ? `?orgNodeId=${orgNodeId}` : ''}`,
    ),
  createPayment: (data: CreatePaymentInput) =>
    api.post<{ payment: PaymentRecord }>('/finance/payments', data),
  postPayment: (id: string) =>
    api.post<{ payment: PaymentRecord }>(`/finance/payments/${id}/post`, {}),

  getCollections: (jobOrderReference?: string) =>
    api.get<{ collections: CollectionRecord[] }>(
      `/finance/collections${jobOrderReference ? `?jobOrderReference=${jobOrderReference}` : ''}`,
    ),
  recordCollection: (data: CreateCollectionInput) =>
    api.post<{ collection: CollectionRecord }>('/finance/collections', data),
};

/** A fixed asset from the assets module (the legacy accounting/fixed-assets register was migrated there). */
export interface FixedAssetRecord {
  id: string;
  assetCode: string;
  name: string;
  categoryId: string;
  status: 'draft' | 'cwip' | 'in_use' | 'fully_depreciated' | 'scrapped' | 'merged';
  grossValue: string;
  salvageValue: string;
  accumulatedDepreciation: string;
  periods: number;
  availableForUseDate: string | null;
}
export interface AssetCategoryRecord {
  id: string;
  orgNodeId: string;
  code: string;
  name: string;
}

export const accountingApi = {
  getFixedAssets: (orgNodeId?: string) =>
    api.get<{ assets: FixedAssetRecord[] }>(`/assets${orgNodeId ? `?orgNodeId=${orgNodeId}` : ''}`),
  getAssetCategories: () => api.get<{ categories: AssetCategoryRecord[] }>('/assets/categories'),
  createFixedAsset: (data: {
    assetCode: string;
    name: string;
    categoryId: string;
    grossValue: string;
    salvageValue?: string;
    periods: number;
  }) => api.post<{ asset: FixedAssetRecord }>('/assets', data),
  /** A bought asset goes into use and gets its depreciation schedule. */
  submitFixedAsset: (id: string, availableForUseDate: string) =>
    api.post<{ asset: FixedAssetRecord }>(`/assets/${id}/submit`, { availableForUseDate }),
  /** Posts every scheduled depreciation row due on or before `asOf`, for all assets. */
  postDueDepreciation: (asOf?: string) =>
    api.post<{ posted: Array<{ assetCode: string; rowNumber: number; amount: string }> }>(
      '/assets/depreciate-due',
      { asOf },
    ),

  getTrialBalance: (orgNodeId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ orgNodeId });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return api.get<TrialBalanceReport>(`/accounting/reports/trial-balance?${params}`);
  },
  getProfitAndLoss: (orgNodeId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ orgNodeId });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return api.get<ProfitAndLossReport>(`/accounting/reports/profit-and-loss?${params}`);
  },
  getBalanceSheet: (orgNodeId: string, endDate?: string) => {
    const params = new URLSearchParams({ orgNodeId });
    if (endDate) params.set('endDate', endDate);
    return api.get<BalanceSheetReport>(`/accounting/reports/balance-sheet?${params}`);
  },
  getPartnerLedger: (partyType: string, partyId: string) =>
    api.get<PartnerLedgerReport>(
      `/accounting/reports/partner-ledger?partyType=${partyType}&partyId=${partyId}`,
    ),

  getJournalEntries: () =>
    api.get<{ entries: JournalEntryRecord[] }>('/accounting/journal-entries'),
  postJournalEntry: (id: string) =>
    api.post<{ entry: JournalEntryRecord }>(`/accounting/journal-entries/${id}/post`, {}),
};
