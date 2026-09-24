import { Fragment, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';

interface AuditEntry {
  id: string;
  entityName: string;
  entityId: string;
  action: string;
  performedBy: string | null;
  performedByName: string | null;
  ipAddress: string | null;
  newValues: string | null;
  details: string | null;
  createdAt: string;
}
interface UserOption {
  id: string;
  username: string;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'إنشاء',
  UPDATE: 'تعديل',
  DELETE: 'حذف',
  POST: 'ترحيل',
  CANCEL: 'إلغاء',
  RECEIVE: 'استلام',
  SUBMIT: 'اعتماد',
  REVERSE: 'عكس',
};
const ACTION_TONE: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-sky-100 text-sky-800',
  DELETE: 'bg-rose-100 text-rose-700',
};
const input = 'mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
const label = 'block text-xs font-bold text-slate-600';

function pretty(json: string | null): string {
  if (!json) return '—';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

/**
 * سجل التدقيق الحقيقي: كل تغيير ناجح في النظام (إنشاء، تعديل، حذف، ترحيل، ...) بيتسجل تلقائيًا
 * مين عمله وإمتى ومن أي جهاز والقيم اللي اتبعتت. السجل للقراءة بس.
 */
export function AuditLogPage(): JSX.Element {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [entityName, setEntityName] = useState('');
  const [action, setAction] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setError(null);
    try {
      const q = new URLSearchParams();
      if (entityName.trim()) q.set('entityName', entityName.trim());
      if (action) q.set('action', action);
      if (performedBy) q.set('performedBy', performedBy);
      setRows(await api.get<AuditEntry[]>(`/audit/logs?${q}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل سجل التدقيق');
    }
  }

  useEffect(() => {
    void load();
    void api
      .get<{ users: UserOption[] }>('/auth/users')
      .then((r) => setUsers(r.users))
      .catch(() => setUsers([]));
  }, []);

  const entities = [...new Set(rows.map((r) => r.entityName))].sort();

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">سجل التدقيق</h1>
        <p className="text-sm text-slate-500 mt-1">
          كل تغيير ناجح بيتسجل تلقائيًا: مين، وإمتى، ومن أي عنوان، والقيم اللي اتبعتت. السجل للقراءة
          بس ومحدش يقدر يضيف فيه أو يعدّله. آخر 100 حركة.
        </p>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <label className={label}>
          الشاشة / الكيان
          <input
            className={input}
            list="audit-entities"
            placeholder="مثال: crm/contacts"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
          />
          <datalist id="audit-entities">
            {entities.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </label>
        <label className={label}>
          العملية
          <select className={input} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">الكل</option>
            {Object.entries(ACTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          المستخدم
          <select
            className={input}
            value={performedBy}
            onChange={(e) => setPerformedBy(e.target.value)}
          >
            <option value="">الكل</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
        </label>
        <button
          className="px-4 py-2 rounded-lg text-sm font-bold cursor-pointer bg-teal-600 hover:bg-teal-700 text-white"
          onClick={() => void load()}
        >
          بحث
        </button>
      </div>

      {error && (
        <div className="text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">مفيش حركات مسجلة بالشروط دي</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-200">
                <th className="text-right py-2">الوقت</th>
                <th className="text-right py-2">المستخدم</th>
                <th className="text-right py-2">العملية</th>
                <th className="text-right py-2">الكيان</th>
                <th className="text-right py-2">المعرّف</th>
                <th className="text-right py-2">العنوان</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('ar-EG')}
                    </td>
                    <td className="py-2">{r.performedByName ?? '—'}</td>
                    <td className="py-2">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${ACTION_TONE[r.action] ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {ACTION_LABEL[r.action] ?? r.action}
                      </span>
                    </td>
                    <td className="py-2" dir="ltr">
                      {r.entityName}
                    </td>
                    <td className="py-2 font-mono text-xs" dir="ltr">
                      {r.entityId.slice(0, 8)}
                    </td>
                    <td className="py-2 text-xs text-slate-500" dir="ltr">
                      {r.ipAddress ?? '—'}
                    </td>
                    <td className="py-2 text-left">
                      <button
                        className="text-xs text-teal-700 underline cursor-pointer"
                        onClick={() => setOpen(open === r.id ? null : r.id)}
                      >
                        {open === r.id ? 'إخفاء' : 'التفاصيل'}
                      </button>
                    </td>
                  </tr>
                  {open === r.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="p-3">
                        <div className="text-xs text-slate-500 mb-1" dir="ltr">
                          {r.details}
                        </div>
                        <pre
                          className="text-xs bg-white border border-slate-200 rounded p-2 overflow-x-auto"
                          dir="ltr"
                        >
                          {pretty(r.newValues)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AuditLogPage;
