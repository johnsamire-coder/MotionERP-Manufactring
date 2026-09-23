import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';

interface UserRecord { id: string; username: string; status: string; }
interface WarehouseRecord { id: string; code: string; name: string; }
interface OrgTreeNode { id: string; name: string; nodeType: string; children: OrgTreeNode[]; }
interface UserPermissionRecord { id: string; userId: string; allowType: 'org_node' | 'warehouse'; allowValue: string; }

interface Option { id: string; label: string; }

function flattenTree(nodes: OrgTreeNode[], depth = 0): Option[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: `${'— '.repeat(depth)}${n.name} (${n.nodeType})` },
    ...flattenTree(n.children, depth + 1),
  ]);
}

/**
 * تقييد المستخدم (بند 5.1): ربط مستخدم واحد بفروع أو مخازن معيّنة.
 * لو المستخدم مالوش أي قيد من نوع معيّن، يبقى مش متقيّد في النوع ده.
 */
export function UserRestrictionsPage(): JSX.Element {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [warehouses, setWarehouses] = useState<Option[]>([]);
  const [orgNodes, setOrgNodes] = useState<Option[]>([]);
  const [userId, setUserId] = useState('');
  const [rows, setRows] = useState<UserPermissionRecord[]>([]);
  const [allowType, setAllowType] = useState<'org_node' | 'warehouse'>('warehouse');
  const [allowValue, setAllowValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const [u, w, o] = await Promise.all([
          api.get<{ users: UserRecord[] }>('/auth/users'),
          api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses').catch(() => ({ warehouses: [] })),
          api.get<{ tree: OrgTreeNode[] }>('/organization/tree').catch(() => ({ tree: [] })),
        ]);
        setUsers(u.users);
        setWarehouses(w.warehouses.map((x) => ({ id: x.id, label: `${x.code} — ${x.name}` })));
        setOrgNodes(flattenTree(o.tree));
        if (u.users[0]) setUserId(u.users[0].id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'فشل تحميل البيانات');
      }
    })();
  }, []);

  async function loadRows(id: string): Promise<void> {
    if (!id) { setRows([]); return; }
    try {
      const res = await api.get<{ userPermissions: UserPermissionRecord[] }>(`/auth/user-permissions?userId=${id}`);
      setRows(res.userPermissions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل القيود');
    }
  }

  useEffect(() => { void loadRows(userId); }, [userId]);

  const labelOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of [...warehouses, ...orgNodes]) map.set(o.id, o.label.replace(/^(— )+/, ''));
    return (id: string): string => map.get(id) ?? id;
  }, [warehouses, orgNodes]);

  const options = allowType === 'warehouse' ? warehouses : orgNodes;

  async function add(): Promise<void> {
    if (!userId || !allowValue) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/user-permissions', { userId, allowType, allowValue });
      setAllowValue('');
      await loadRows(userId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إضافة القيد');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/auth/user-permissions/${id}`);
      await loadRows(userId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل حذف القيد');
    } finally {
      setBusy(false);
    }
  }

  const byType = (t: 'org_node' | 'warehouse'): UserPermissionRecord[] => rows.filter((r) => r.allowType === t);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">تقييد المستخدمين بفرع أو مخزن</h1>
        <p className="text-sm text-slate-500 mt-1">
          المستخدم اللي مالوش قيود من نوع معيّن مش متقيّد فيه. التقييد بفرع بيشمل كل اللي تحته في الشجرة.
        </p>
      </div>

      {error && <div className="text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3">{error}</div>}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <label className="block text-xs font-bold text-slate-600">
          المستخدم
          <select className="mt-1 w-full md:w-80 border border-slate-300 rounded-lg px-3 py-2 text-sm" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.username}{u.status !== 'active' ? ` (${u.status})` : ''}</option>)}
          </select>
        </label>

        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <label className="block text-xs font-bold text-slate-600">
            نوع القيد
            <select
              className="mt-1 w-full md:w-40 border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={allowType}
              onChange={(e) => { setAllowType(e.target.value as 'org_node' | 'warehouse'); setAllowValue(''); }}
            >
              <option value="warehouse">مخزن</option>
              <option value="org_node">فرع / شركة</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-600 flex-1">
            القيمة
            <select className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={allowValue} onChange={(e) => setAllowValue(e.target.value)}>
              <option value="">— اختر —</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <button
            onClick={() => void add()}
            disabled={busy || !userId || !allowValue}
            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold cursor-pointer"
          >
            إضافة قيد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(['warehouse', 'org_node'] as const).map((t) => (
          <div key={t} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-3">{t === 'warehouse' ? 'المخازن المسموحة' : 'الفروع المسموحة'}</h3>
            {byType(t).length === 0 ? (
              <p className="text-sm text-slate-400">غير متقيّد — مسموح بالكل</p>
            ) : (
              <ul className="space-y-2">
                {byType(t).map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <span>{labelOf(r.allowValue)}</span>
                    <button onClick={() => void remove(r.id)} disabled={busy} className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer">
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default UserRestrictionsPage;
