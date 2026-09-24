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

export const financeApi = {
  getPurchaseInvoices: (orgNodeId?: string) =>
    api.get<{ purchaseInvoices: any[] }>(
      `/finance/purchase-invoices${orgNodeId ? `?orgNodeId=${orgNodeId}` : ''}`,
    ),
  createPurchaseInvoice: (data: any) =>
    api.post<{ purchaseInvoice: any }>('/finance/purchase-invoices', data),
  postPurchaseInvoice: (id: string) =>
    api.post<{ purchaseInvoice: any }>(`/finance/purchase-invoices/${id}/post`, {}),

  getSalesInvoices: (orgNodeId?: string) =>
    api.get<{ salesInvoices: any[] }>(
      `/finance/sales-invoices${orgNodeId ? `?orgNodeId=${orgNodeId}` : ''}`,
    ),
  createSalesInvoice: (data: any) =>
    api.post<{ salesInvoice: any }>('/finance/sales-invoices', data),
  postSalesInvoice: (id: string) =>
    api.post<{ salesInvoice: any }>(`/finance/sales-invoices/${id}/post`, {}),

  getPayments: (orgNodeId?: string) =>
    api.get<{ payments: any[] }>(`/finance/payments${orgNodeId ? `?orgNodeId=${orgNodeId}` : ''}`),
  createPayment: (data: any) => api.post<{ payment: any }>('/finance/payments', data),
  postPayment: (id: string) => api.post<{ payment: any }>(`/finance/payments/${id}/post`, {}),

  getCollections: (jobOrderReference?: string) =>
    api.get<{ collections: any[] }>(
      `/finance/collections${jobOrderReference ? `?jobOrderReference=${jobOrderReference}` : ''}`,
    ),
  recordCollection: (data: any) => api.post<{ collection: any }>('/finance/collections', data),
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
    return api.get<any>(`/accounting/reports/trial-balance?${params}`);
  },
  getProfitAndLoss: (orgNodeId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ orgNodeId });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return api.get<any>(`/accounting/reports/profit-and-loss?${params}`);
  },
  getBalanceSheet: (orgNodeId: string, endDate?: string) => {
    const params = new URLSearchParams({ orgNodeId });
    if (endDate) params.set('endDate', endDate);
    return api.get<any>(`/accounting/reports/balance-sheet?${params}`);
  },
  getPartnerLedger: (partyType: string, partyId: string) =>
    api.get<any>(`/accounting/reports/partner-ledger?partyType=${partyType}&partyId=${partyId}`),

  getJournalEntries: () => api.get<{ entries: any[] }>('/accounting/journal-entries'),
  postJournalEntry: (id: string) =>
    api.post<{ entry: any }>(`/accounting/journal-entries/${id}/post`, {}),
};
