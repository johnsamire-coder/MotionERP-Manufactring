import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface WorkCenterRecord { id: string; code: string; name: string; }
interface EmployeeRecord { id: string; code: string; name: string; }
interface DowntimeEntryRecord {
  id: string; workCenterId: string; operatorEmployeeId: string | null; stopReason: string;
  startTime: string; stopTime: string | null; stoppageMinutes: string | null; remarks: string | null;
}

export function DowntimeEntryPage(): JSX.Element {
  const { t } = useTranslation();
  const [workCenters, setWorkCenters] = useState<WorkCenterRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [entries, setEntries] = useState<DowntimeEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [workCenterId, setWorkCenterId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [stopReason, setStopReason] = useState('');
  const [startTime, setStartTime] = useState('');
  const [remarks, setRemarks] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [wcRes, empRes, dteRes] = await Promise.all([
        api.get<{ workCenters: WorkCenterRecord[] }>('/production-ops/work-centers'),
        api.get<{ employees: EmployeeRecord[] }>('/hr/employees'),
        api.get<{ downtimeEntries: DowntimeEntryRecord[] }>('/production-ops/downtime-entries'),
      ]);
      setWorkCenters(wcRes.workCenters);
      setEmployees(empRes.employees);
      setEntries(dteRes.downtimeEntries);
      if (!workCenterId && wcRes.workCenters[0]) setWorkCenterId(wcRes.workCenters[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load downtime entry data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/production-ops/downtime-entries', {
        workCenterId, operatorEmployeeId: operatorId || undefined,
        stopReason, startTime: new Date(startTime).toISOString(), remarks: remarks || undefined,
      });
      setStopReason(''); setStartTime(''); setRemarks('');
      setShowForm(false);
      setFormSuccess(t('pages.downtime_entry.createEntry'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleClose(id: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/production-ops/downtime-entries/${id}/close`, {});
      setFormSuccess(t('pages.downtime_entry.close'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const wcLabel = (id: string): string => workCenters.find((w) => w.id === id)?.name ?? id;
  const empLabel = (id: string | null): string => (id ? (employees.find((e) => e.id === id)?.name ?? id) : '—');
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading) return <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.downtime_entry.eyebrow')}</span>
          <h1>{t('pages.downtime_entry.title')}</h1>
          <p>{t('pages.downtime_entry.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Plant Floor</span>
            <h2>{t('pages.downtime_entry.listTitle')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowForm((v) => !v)}><b>+</b>{t('pages.downtime_entry.createEntry')}</button>
        </div>

        {showForm && (
          <form onSubmit={(e) => { void handleCreate(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.downtime_entry.workCenter')}</label>
              <select value={workCenterId} onChange={(e) => setWorkCenterId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                {workCenters.map((wc) => <option key={wc.id} value={wc.id}>{wc.name} ({wc.code})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.downtime_entry.operator')}</label>
              <select value={operatorId} onChange={(e) => setOperatorId(e.target.value)} style={{ ...inputStyle, minWidth: 160 }}>
                <option value="">—</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.downtime_entry.stopReason')}</label>
              <input value={stopReason} onChange={(e) => setStopReason(e.target.value)} required placeholder="e.g. Blade replacement" style={{ ...inputStyle, minWidth: 200 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.downtime_entry.startTime')}</label>
              <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.downtime_entry.remarks')}</label>
              <input value={remarks} onChange={(e) => setRemarks(e.target.value)} style={{ ...inputStyle, minWidth: 180 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.technical.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.downtime_entry.workCenter')}</span>
            <span>{t('pages.downtime_entry.stopReason')}</span>
            <span>{t('pages.downtime_entry.operator')}</span>
            <span>{t('pages.downtime_entry.duration')}</span>
            <span>{t('common.filter')}</span>
          </div>
          {entries.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.downtime_entry.noEntries')}</p>}
          {entries.map((dte) => (
            <div className="placeholder-table__row" key={dte.id}>
              <span><b>{wcLabel(dte.workCenterId)}</b></span>
              <span>{dte.stopReason}</span>
              <span>{empLabel(dte.operatorEmployeeId)}</span>
              <span>
                {dte.stoppageMinutes
                  ? `${Number(dte.stoppageMinutes).toFixed(1)} min`
                  : <span className="status status--warning"><i />{t('pages.downtime_entry.open')}</span>}
              </span>
              <span>
                {!dte.stopTime && (
                  <button className="filter-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { void handleClose(dte.id); }}>
                    {t('pages.downtime_entry.close')}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
