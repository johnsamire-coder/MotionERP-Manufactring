import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface WorkOrderRecord {
  id: string;
  workOrderNumber: string;
  productItemId: string;
  qtyToManufacture: string;
  status: string;
}
interface ProductionStepRecord {
  id: string;
  status: string;
}
interface BomRecord {
  id: string;
}
interface ItemRecord {
  id: string;
  code: string;
  name: string;
}

export function ManufacturingPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [steps, setSteps] = useState<ProductionStepRecord[]>([]);
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [woRes, stepsRes, bomsRes, itemsRes] = await Promise.all([
        api.get<{ workOrders: WorkOrderRecord[] }>('/production-ops/work-orders'),
        api.get<{ steps: ProductionStepRecord[] }>('/production-ops/steps'),
        api.get<{ boms: BomRecord[] }>('/technical/boms'),
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
      ]);
      setWorkOrders(woRes.workOrders ?? []);
      setSteps(stepsRes.steps ?? []);
      setBoms(bomsRes.boms ?? []);
      setItems(itemsRes.items ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load manufacturing dashboard data',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  const totalWorkOrders = workOrders.length;
  const inProgressCount = workOrders.filter((w) => w.status === 'in_progress').length;
  const ongoingJobCards = steps.filter((s) => s.status === 'in_progress').length;
  const totalBoms = boms.length;

  const itemLabel = (id: string): string => items.find((it) => it.id === id)?.name ?? id;
  const statusColors: Record<string, string> = {
    not_started: '#94a3b8',
    in_progress: '#f59e0b',
    completed: '#22c55e',
    stopped: '#ef4444',
    closed: '#64748b',
  };

  // Work Order Analysis: bar chart of qty to manufacture per production item
  const barData = workOrders.map((w) => ({
    label: itemLabel(w.productItemId),
    qty: Number(w.qtyToManufacture),
  }));
  const maxQty = Math.max(...barData.map((d) => d.qty), 1);

  // Work Order Quantity Analysis: donut by status
  const statusCounts: Record<string, number> = {};
  for (const w of workOrders) statusCounts[w.status] = (statusCounts[w.status] ?? 0) + 1;
  const donutTotal = workOrders.length || 1;
  let donutOffset = 0;
  const donutSegments = Object.entries(statusCounts).map(([status, count]) => {
    const pct = (count / donutTotal) * 100;
    const seg = { status, count, pct, offset: donutOffset };
    donutOffset += pct;
    return seg;
  });

  // Pending Work Order: line-ish bars of qty not yet manufactured (approximated as qtyToManufacture for non-completed/closed)
  const pendingData = workOrders
    .filter((w) => w.status !== 'completed' && w.status !== 'closed')
    .map((w) => ({ label: itemLabel(w.productItemId), qty: Number(w.qtyToManufacture) }));
  const maxPending = Math.max(...pendingData.map((d) => d.qty), 1);

  const cardStyle = {
    background: '#fff',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    padding: 20,
  };
  const kpiValueStyle = { fontSize: 32, fontWeight: 'bold' as const, margin: '4px 0 0' };
  const kpiLabelStyle = { fontSize: 13, color: '#64748b' };

  if (loading)
    return (
      <p style={{ padding: 40, textAlign: 'center' }}>{t('pages.production_ops.form.loading')}</p>
    );

  return (
    <section className="module-page" style={{ position: 'relative', paddingBottom: 80 }}>
      <div className="page-intro">
        <div>
          <span className="eyebrow">Manufacturing</span>
          <h1>{t('pages.manufacturing.dashboard.title')}</h1>
        </div>
      </div>

      {error && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{error}</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div style={cardStyle}>
          <span style={kpiLabelStyle}>{t('pages.manufacturing.dashboard.totalWorkOrders')}</span>
          <p style={kpiValueStyle}>{totalWorkOrders}</p>
        </div>
        <div style={cardStyle}>
          <span style={kpiLabelStyle}>
            {t('pages.manufacturing.dashboard.workOrdersInProgress')}
          </span>
          <p style={{ ...kpiValueStyle, color: '#f59e0b' }}>{inProgressCount}</p>
        </div>
        <div style={cardStyle}>
          <span style={kpiLabelStyle}>{t('pages.manufacturing.dashboard.ongoingJobCards')}</span>
          <p style={{ ...kpiValueStyle, color: '#0369a1' }}>{ongoingJobCards}</p>
        </div>
        <div style={cardStyle}>
          <span style={kpiLabelStyle}>{t('pages.manufacturing.dashboard.totalBoms')}</span>
          <p style={{ ...kpiValueStyle, color: '#166534' }}>{totalBoms}</p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>
            {t('pages.manufacturing.dashboard.workOrderAnalysis')}
          </h3>
          {barData.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>—</p>}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
            {barData.map((d, idx) => (
              <div
                key={idx}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: 32,
                    height: `${(d.qty / maxQty) * 130}px`,
                    background: '#3b82f6',
                    borderRadius: '3px 3px 0 0',
                  }}
                  title={`${d.label}: ${d.qty}`}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: '#64748b',
                    marginTop: 4,
                    textAlign: 'center',
                    maxWidth: 50,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>
            {t('pages.manufacturing.dashboard.workOrderQtyAnalysis')}
          </h3>
          {workOrders.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>—</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <svg
                viewBox="0 0 42 42"
                style={{ width: 140, height: 140, transform: 'rotate(-90deg)' }}
              >
                <circle
                  cx="21"
                  cy="21"
                  r="15.9"
                  fill="transparent"
                  stroke="#e2e8f0"
                  strokeWidth="6"
                />
                {donutSegments.map((seg, idx) => (
                  <circle
                    key={idx}
                    cx="21"
                    cy="21"
                    r="15.9"
                    fill="transparent"
                    stroke={statusColors[seg.status] ?? '#94a3b8'}
                    strokeWidth="6"
                    strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
                    strokeDashoffset={-seg.offset}
                  />
                ))}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {donutSegments.map((seg, idx) => (
                  <div
                    key={idx}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: statusColors[seg.status] ?? '#94a3b8',
                        display: 'inline-block',
                      }}
                    />
                    {seg.status} ({seg.count})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>
            {t('pages.manufacturing.dashboard.pendingWorkOrder')}
          </h3>
          {pendingData.length === 0 && <p style={{ color: '#94a3b8', fontSize: 13 }}>—</p>}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
            {pendingData.map((d, idx) => (
              <div
                key={idx}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: 32,
                    height: `${(d.qty / maxPending) * 130}px`,
                    background: '#f59e0b',
                    borderRadius: '3px 3px 0 0',
                  }}
                  title={`${d.label}: ${d.qty}`}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: '#64748b',
                    marginTop: 4,
                    textAlign: 'center',
                    maxWidth: 50,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <a
        href="/bom"
        className="primary-button"
        style={{
          position: 'fixed',
          bottom: 30,
          insetInlineEnd: 30,
          borderRadius: 999,
          padding: '14px 24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          textDecoration: 'none',
        }}
      >
        + {t('pages.manufacturing.dashboard.createBom')}
      </a>
    </section>
  );
}
