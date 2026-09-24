// ============================================================
// Motion ERP — RBAC API Client
// Step 95
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const rbacApi = {
  async getRolesMatrix() {
    try {
      const res = await fetch(`${API_BASE}/v1/auth/rbac/roles-matrix`);
      if (!res.ok) throw new Error('Failed to fetch roles matrix');
      return await res.json();
    } catch (err) {
      console.warn('Backend RBAC endpoint offline, using local roles dataset:', err);
      return null;
    }
  },

  async getAllPermissions() {
    try {
      const res = await fetch(`${API_BASE}/v1/auth/rbac/permissions`);
      if (!res.ok) throw new Error('Failed to fetch permissions list');
      return await res.json();
    } catch (err) {
      console.warn('Backend permissions endpoint offline, using local dataset:', err);
      return null;
    }
  },

  async updateRolePermissions(payload: {
    roleId: string;
    roleName: string;
    permissions: string[];
  }) {
    const res = await fetch(`${API_BASE}/v1/auth/rbac/update-permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update permissions');
    return await res.json();
  },
};
