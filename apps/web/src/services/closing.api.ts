// ============================================================
// Motion ERP — Period & Fiscal Year Closing API Client
// Step 93
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const closingApi = {
  // ── 1. فحص وإقفال الفترات الشهرية ────────────
  async runPreClosingChecks(periodId: string, companyId?: string) {
    try {
      const params = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      const res = await fetch(`${API_BASE}/v1/accounting/closing/pre-check/${periodId}${params}`);
      if (!res.ok) throw new Error('Failed to run pre-closing checks');
      return await res.json();
    } catch (err) {
      console.warn('Backend closing pre-check offline, using local verification:', err);
      return null;
    }
  },

  async closePeriod(payload: any) {
    const res = await fetch(`${API_BASE}/v1/accounting/closing/close-period`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to close period');
    return await res.json();
  },

  async reopenPeriod(payload: any) {
    const res = await fetch(`${API_BASE}/v1/accounting/closing/reopen-period`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to reopen period');
    return await res.json();
  },

  // ── 2. معاينة وتنفيذ الإقفال السنوي ──────────
  async previewFiscalYearClosing(fiscalYearId: string, companyId?: string) {
    try {
      const params = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      const res = await fetch(`${API_BASE}/v1/accounting/fiscal-year-closing/preview/${fiscalYearId}${params}`);
      if (!res.ok) throw new Error('Failed to preview fiscal year closing');
      return await res.json();
    } catch (err) {
      console.warn('Backend fiscal year preview offline, using local forecast:', err);
      return null;
    }
  },

  async executeFiscalYearClosing(payload: any) {
    const res = await fetch(`${API_BASE}/v1/accounting/fiscal-year-closing/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to execute fiscal year closing');
    return await res.json();
  },

  // ── 3. تدوير الأرصدة والقيود الافتتاحية ────────
  async rollForwardOpeningBalances(payload: any) {
    const res = await fetch(`${API_BASE}/v1/accounting/opening-entries/roll-forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to roll forward opening balances');
    return await res.json();
  },
};