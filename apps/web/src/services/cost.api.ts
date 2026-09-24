// ============================================================
// Motion ERP — Costing & Variance Analysis API Client
// Step 83
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const costApi = {
  // ── 1. جلب كارت التكلفة الفعلي ──────────────
  async getJobCostSheet(workOrderId: string) {
    try {
      const res = await fetch(
        `${API_BASE}/v1/cost/job-cost-sheet/${encodeURIComponent(workOrderId)}`,
      );
      if (!res.ok) throw new Error('Failed to fetch job cost sheet');
      return await res.json();
    } catch (err) {
      console.warn('Backend cost endpoint offline, using local standard dataset:', err);
      return null;
    }
  },

  // ── 2. جلب مقارنة المعياري بالفعلي ──────────
  async getStandardVsActual(workOrderId: string) {
    try {
      const res = await fetch(
        `${API_BASE}/v1/cost/standard-vs-actual/${encodeURIComponent(workOrderId)}`,
      );
      if (!res.ok) throw new Error('Failed to fetch standard vs actual');
      return await res.json();
    } catch (err) {
      console.warn('Backend cost endpoint offline, using local standard dataset:', err);
      return null;
    }
  },

  // ── 3. جلب تفكيك انحرافات المواد الرباعي ─────
  async get4LevelMaterialVariance(workOrderId: string) {
    try {
      const res = await fetch(
        `${API_BASE}/v1/cost/material-variance/${encodeURIComponent(workOrderId)}`,
      );
      if (!res.ok) throw new Error('Failed to fetch 4-level variance');
      return await res.json();
    } catch (err) {
      console.warn('Backend cost endpoint offline, using local standard dataset:', err);
      return null;
    }
  },
};
