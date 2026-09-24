// ============================================================
// Motion ERP — Audit Trail API Client
// Step 94
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const auditApi = {
  async getLogs(query?: { entityName?: string; action?: string }) {
    try {
      const params = new URLSearchParams(query as Record<string, string> | undefined).toString();
      const res = await fetch(`${API_BASE}/v1/audit/logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return await res.json();
    } catch (err) {
      console.warn('Backend audit endpoint offline, using local standard dataset:', err);
      return null;
    }
  },

  async getEntityHistory(entityName: string, entityId: string) {
    const res = await fetch(
      `${API_BASE}/v1/audit/history/${encodeURIComponent(entityName)}/${encodeURIComponent(entityId)}`,
    );
    if (!res.ok) throw new Error('Failed to fetch entity history');
    return await res.json();
  },
};
