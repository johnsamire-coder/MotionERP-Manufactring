// ============================================================
// Motion ERP — Overhead Allocation API Client
// Step 86
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const overheadApi = {
  // ── 1. جلب ملخص مجمعات التكاليف وفروق الامتصاص ──
  async getPoolsSummary(periodMonth?: string) {
    try {
      const params = periodMonth ? `?periodMonth=${encodeURIComponent(periodMonth)}` : '';
      const res = await fetch(`${API_BASE}/v1/overhead/pools/summary${params}`);
      if (!res.ok) throw new Error('Failed to fetch overhead pools summary');
      return await res.json();
    } catch (err) {
      console.warn('Backend overhead endpoint offline, using local standard dataset:', err);
      return null;
    }
  },

  // ── 2. تشغيل دورة التوزيع والتحميل الشهري ─────────
  async runAllocation(payload: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/v1/overhead/allocate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to run overhead allocation');
    return await res.json();
  },

  // ── 3. دمج إهلاك الماكينات الشهري مع التكلفة ──
  async integrateMachineryDepreciation(payload: {
    companyId: string;
    fiscalYearId: string;
    periodId: string;
    periodMonth: string;
    totalMachineryDepreciation: number;
    machinesBreakdown?: Array<Record<string, unknown>>;
  }) {
    const res = await fetch(`${API_BASE}/v1/overhead/integrate-depreciation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to integrate machinery depreciation');
    return await res.json();
  },
};
