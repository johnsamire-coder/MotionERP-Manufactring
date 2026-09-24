import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface WorkstationTypeRecord {
  id: string;
  code: string;
  name: string;
  status: string;
}
interface WorkCenterRecord {
  id: string;
  code: string;
  name: string;
}
interface OperationRecord {
  id: string;
  code: string;
  name: string;
  defaultWorkCenterId: string | null;
  standardTimeMinutes: string | null;
  status: string;
}

function nextCode(prefix: string, existingCodes: string[]): string {
  const matching = existingCodes.filter((c) => c.toUpperCase().startsWith(prefix.toUpperCase()));
  return `${prefix}-${String(matching.length + 1).padStart(4, '0')}`;
}

export function SetupPage(): JSX.Element {
  const { t } = useTranslation();
  const [workstationTypes, setWorkstationTypes] = useState<WorkstationTypeRecord[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenterRecord[]>([]);
  const [operations, setOperations] = useState<OperationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [showWsForm, setShowWsForm] = useState(false);
  const [wsCode, setWsCode] = useState('');
  const [wsName, setWsName] = useState('');

  const [showOpForm, setShowOpForm] = useState(false);
  const [opCode, setOpCode] = useState('');
  const [opName, setOpName] = useState('');
  const [opWorkCenterId, setOpWorkCenterId] = useState('');
  const [opStdTime, setOpStdTime] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [wsRes, wcRes, opRes] = await Promise.all([
        api.get<{ workstationTypes: WorkstationTypeRecord[] }>('/production-ops/workstation-types'),
        api.get<{ workCenters: WorkCenterRecord[] }>('/production-ops/work-centers'),
        api.get<{ operations: OperationRecord[] }>('/production-ops/operations'),
      ]);
      setWorkstationTypes(wsRes.workstationTypes);
      setWorkCenters(wcRes.workCenters);
      setOperations(opRes.operations);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load setup data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function openWsForm(): void {
    setWsCode(
      nextCode(
        'WST',
        workstationTypes.map((w) => w.code),
      ),
    );
    setShowWsForm((v) => !v);
  }

  function openOpForm(): void {
    setOpCode(
      nextCode(
        'OP',
        operations.map((o) => o.code),
      ),
    );
    setShowOpForm((v) => !v);
  }

  async function handleCreateWs(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await api.post('/production-ops/workstation-types', { code: wsCode, name: wsName });
      setWsName('');
      setShowWsForm(false);
      setFormSuccess(t('pages.production_ops.form.success'));
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateOp(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await api.post('/production-ops/operations', {
        code: opCode,
        name: opName,
        defaultWorkCenterId: opWorkCenterId || undefined,
        standardTimeMinutes: opStdTime || undefined,
      });
      setOpName('');
      setShowOpForm(false);
      setFormSuccess(t('pages.production_ops.form.success'));
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  const wcLabel = (id: string | null): string =>
    id ? (workCenters.find((w) => w.id === id)?.name ?? id) : '—';
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  if (loading)
    return (
      <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>
    );

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.setup.eyebrow')}</span>
          <h1>{t('pages.setup.title')}</h1>
          <p>{t('pages.setup.description')}</p>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}
      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      <article className="panel module-panel" style={{ marginBottom: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Setup</span>
            <h2>{t('pages.setup.workstationTypes')}</h2>
          </div>
          <button className="primary-button" onClick={openWsForm}>
            <b>+</b> {t('pages.setup.addWorkstationType')}
          </button>
        </div>

        {showWsForm && (
          <form
            onSubmit={(e) => {
              void handleCreateWs(e);
            }}
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'end',
              padding: '0 0 20px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.setup.code')}</label>
              <input
                value={wsCode}
                onChange={(e) => setWsCode(e.target.value)}
                required
                style={{ ...inputStyle, width: 120 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.setup.name')}</label>
              <input
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                required
                placeholder="e.g. Machine"
                style={{ ...inputStyle, minWidth: 200 }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="primary-button"
              style={{ height: 38 }}
            >
              {t('pages.production_ops.form.save')}
            </button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.setup.code')}</span>
            <span>{t('pages.setup.name')}</span>
          </div>
          {workstationTypes.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t('pages.setup.noWorkstationTypes')}
            </p>
          )}
          {workstationTypes.map((ws) => (
            <div className="placeholder-table__row" key={ws.id}>
              <span>
                <b>{ws.code}</b>
              </span>
              <span>{ws.name}</span>
            </div>
          ))}
        </div>
      </article>

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Setup</span>
            <h2>{t('pages.setup.operations')}</h2>
          </div>
          <button className="primary-button" onClick={openOpForm}>
            <b>+</b> {t('pages.setup.addOperation')}
          </button>
        </div>

        {showOpForm && (
          <form
            onSubmit={(e) => {
              void handleCreateOp(e);
            }}
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'end',
              padding: '0 0 20px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.setup.code')}</label>
              <input
                value={opCode}
                onChange={(e) => setOpCode(e.target.value)}
                required
                style={{ ...inputStyle, width: 120 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.setup.name')}</label>
              <input
                value={opName}
                onChange={(e) => setOpName(e.target.value)}
                required
                placeholder="e.g. Cutting Operation"
                style={{ ...inputStyle, minWidth: 200 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.setup.defaultWorkCenter')}</label>
              <select
                value={opWorkCenterId}
                onChange={(e) => setOpWorkCenterId(e.target.value)}
                style={{ ...inputStyle, minWidth: 180 }}
              >
                <option value="">—</option>
                {workCenters.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.name} ({wc.code})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.setup.standardTime')}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={opStdTime}
                onChange={(e) => setOpStdTime(e.target.value)}
                style={{ ...inputStyle, width: 120 }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="primary-button"
              style={{ height: 38 }}
            >
              {t('pages.production_ops.form.save')}
            </button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.setup.code')}</span>
            <span>{t('pages.setup.name')}</span>
            <span>{t('pages.setup.defaultWorkCenter')}</span>
            <span>{t('pages.setup.standardTime')}</span>
          </div>
          {operations.length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
              {t('pages.setup.noOperations')}
            </p>
          )}
          {operations.map((op) => (
            <div className="placeholder-table__row" key={op.id}>
              <span>
                <b>{op.code}</b>
              </span>
              <span>{op.name}</span>
              <span>{wcLabel(op.defaultWorkCenterId)}</span>
              <span>{op.standardTimeMinutes ? `${op.standardTimeMinutes} min` : '—'}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
