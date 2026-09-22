// ============================================================
// Motion ERP — Medical Traceability & Recall API Client
// Step 72
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface BatchFilter {
  purchaseInvoiceId?: string;
  itemId?: string;
  batchNumber?: string;
  quarantineStatus?: string;
}

export interface SerialFilter {
  customerId?: string;
  salesInvoiceId?: string;
  itemId?: string;
  serialNumber?: string;
  status?: string;
}

export const medicalTraceApi = {
  // ── 1. شحنات ولوطات الموردين ─────────────────
  async getPurchaseBatches(filter?: BatchFilter) {
    try {
      const params = new URLSearchParams(filter as any).toString();
      const res = await fetch(`${API_BASE}/v1/inventory/purchase-batches?${params}`);
      if (!res.ok) throw new Error('Failed to fetch batches');
      return await res.json();
    } catch (err) {
      console.warn('Backend offline or endpoint empty, using local state:', err);
      return null;
    }
  },

  async updateBatchStatus(batchLinkId: string, action: 'accepted' | 'rejected' | 'quarantined', reason?: string) {
    const res = await fetch(`${API_BASE}/v1/inventory/purchase-batches/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchLinkId, action, reason }),
    });
    if (!res.ok) throw new Error('Failed to update batch status');
    return await res.json();
  },

  // ── 2. أجهزة السيريال والضمان بالمستشفيات ────
  async getSalesSerials(filter?: SerialFilter) {
    try {
      const params = new URLSearchParams(filter as any).toString();
      const res = await fetch(`${API_BASE}/v1/sales/serials?${params}`);
      if (!res.ok) throw new Error('Failed to fetch serial devices');
      return await res.json();
    } catch (err) {
      console.warn('Backend offline or endpoint empty, using local state:', err);
      return null;
    }
  },

  async activateWarranty(serialLinkId: string, installationDate: string, installedBy: string, hospitalDepartment?: string) {
    const res = await fetch(`${API_BASE}/v1/sales/serials/activate-warranty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialLinkId, installationDate, installedBy, hospitalDepartment }),
    });
    if (!res.ok) throw new Error('Failed to activate warranty');
    return await res.json();
  },

  // ── 3. التتبع التاريخي والاستدعاء الطبي ──────
  async traceMedicalDevice(serialNumber: string) {
    const res = await fetch(`${API_BASE}/v1/sales/serials/trace/${encodeURIComponent(serialNumber)}`);
    if (!res.ok) throw new Error('Device not found');
    return await res.json();
  },

  async traceBatchOrigin(batchNumber: string) {
    const res = await fetch(`${API_BASE}/v1/inventory/purchase-batches/trace?batchNumber=${encodeURIComponent(batchNumber)}`);
    if (!res.ok) throw new Error('Batch not found');
    return await res.json();
  },
};