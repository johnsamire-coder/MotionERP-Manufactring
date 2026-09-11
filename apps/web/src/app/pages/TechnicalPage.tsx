import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface JobOrderRecord { id: string; jobOrderNumber: string; customerId?: string; status: string; }
interface ItemRecord { id: string; code: string; name: string; }
interface TechDocRecord { id: string; jobOrderReference: string; docType: string; fileRef: string; version: string; createdAt: string; }
interface BomLineInput { itemId: string; plannedQuantity: string; }
interface BomRecord { id: string; jobOrderReference: string; version: string; status: string; createdAt: string; }

export function TechnicalPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [jobOrders, setJobOrders] = useState<JobOrderRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [techDocs, setTechDocs] = useState<TechDocRecord[]>([]);
  const [boms, setBoms] = useState<BomRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Forms state
  const [selectedJO, setSelectedJO] = useState('');
  const [showDocForm, setShowDocForm] = useState(false);
  const [showBomForm, setShowBomForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Tech Doc Form
  const [docType, setDocType] = useState('shop_drawing');
  const [fileRef, setFileRef] = useState('');
  const [docVersion, setDocVersion] = useState('v1.0');

  // BOM Form
  const [bomVersion, setBomVersion] = useState('v1.0');
  const [bomLines, setBomLines] = useState<BomLineInput[]>([{ itemId: '', plannedQuantity: '1' }]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [joRes, itemsRes, docsRes, bomsRes] = await Promise.all([
        api.get<{ jobOrders: JobOrderRecord[] }>('/sales/job-orders'),
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ documents: TechDocRecord[] }>('/technical/documents'),
        api.get<{ boms: BomRecord[] }>('/technical/boms'),
      ]);
      setJobOrders(joRes.jobOrders);
      setItems(itemsRes.items);
      setTechDocs(docsRes.documents);
      setBoms(bomsRes.boms);
      if (!selectedJO && joRes.jobOrders[0]) setSelectedJO(joRes.jobOrders[0].jobOrderNumber);
      if (itemsRes.items[0] && bomLines[0] && !bomLines[0].itemId) {
        setBomLines([{ itemId: itemsRes.items[0].id, plannedQuantity: '1' }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load technical data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  async function handleCreateDoc(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/technical/documents', {
        jobOrderReference: selectedJO,
        docType,
        fileRef,
        version: docVersion,
      });
      setFileRef(''); setShowDocForm(false);
      setFormSuccess(t('pages.technical.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  function addBomLine(): void {
    const defaultItem = items[0]?.id ?? '';
    setBomLines([...bomLines, { itemId: defaultItem, plannedQuantity: '1' }]);
  }

  function updateBomLine(index: number, field: keyof BomLineInput, value: string): void {
    const updated = [...bomLines];
    const current = updated[index];
    if (current) {
      updated[index] = { ...current, [field]: value };
      setBomLines(updated);
    }
  }

  async function handleCreateBom(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/technical/boms', {
        jobOrderReference: selectedJO,
        version: bomVersion,
        lines: bomLines.map((l) => ({ itemId: l.itemId, plannedQuantity: l.plannedQuantity })),
      });
      setShowBomForm(false);
      setFormSuccess(t('pages.technical.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleApproveBom(bomId: string): Promise<void> {
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post(`/technical/boms/${bomId}/approve`, {});
      setFormSuccess(t('pages.technical.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.technical.eyebrow')}</span>
          <h1>{t('pages.technical.title')}</h1>
          <p>{t('pages.technical.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* Selector for Job Order */}
      <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <label style={{ ...labelStyle, fontSize: 14, fontWeight: 'bold' }}>رقم أمر التشغيل المستهدف (Job Order):</label>
        <select value={selectedJO} onChange={(e) => setSelectedJO(e.target.value)} style={{ ...inputStyle, minWidth: 220, fontSize: 14, fontWeight: 'bold' }}>
          {jobOrders.map((jo) => <option key={jo.id} value={jo.jobOrderNumber}>{jo.jobOrderNumber}</option>)}
        </select>
      </div>

      {/* 1. Technical Documents Section */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Engineering Drawings</span>
            <h2>{t('pages.technical.docs.title')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowDocForm((v) => !v)}><b>+</b>{t('pages.technical.docs.addDoc')}</button>
        </div>

        {showDocForm && (
          <form onSubmit={(e) => { void handleCreateDoc(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.technical.docs.docType')}</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} style={inputStyle}>
                <option value="shop_drawing">{t('pages.technical.docs.shopDrawing')}</option>
                <option value="cutting_list">{t('pages.technical.docs.cuttingList')}</option>
                <option value="specification">{t('pages.technical.docs.spec')}</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.technical.docs.fileRef')}</label>
              <input value={fileRef} onChange={(e) => setFileRef(e.target.value)} required placeholder="e.g. //drawings/DWG-JO-001.pdf" style={{ ...inputStyle, minWidth: 240 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.technical.docs.version')}</label>
              <input value={docVersion} onChange={(e) => setDocVersion(e.target.value)} required style={{ ...inputStyle, width: 80 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.technical.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.technical.docs.docType')}</span>
            <span>{t('pages.technical.docs.fileRef')}</span>
            <span>{t('pages.technical.docs.version')}</span>
            <span>تاريخ الإرفاق</span>
          </div>
          {techDocs.filter((d) => d.jobOrderReference === selectedJO).length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.technical.form.empty')}</p>
          )}
          {techDocs.filter((d) => d.jobOrderReference === selectedJO).map((doc) => (
            <div className="placeholder-table__row" key={doc.id}>
              <span><b>{t(`pages.technical.docs.${doc.docType === 'shop_drawing' ? 'shopDrawing' : doc.docType === 'cutting_list' ? 'cuttingList' : 'spec'}`)}</b></span>
              <span><code>{doc.fileRef}</code></span>
              <span><span className="status status--neutral"><i />{doc.version}</span></span>
              <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </article>

      {/* 2. Job Order BOM Section */}
      <article className="panel module-panel" style={{ marginTop: 20 }}>
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">Bill of Materials</span>
            <h2>{t('pages.technical.bom.title')}</h2>
          </div>
          <button className="primary-button" onClick={() => setShowBomForm((v) => !v)}><b>+</b>{t('pages.technical.bom.createBom')}</button>
        </div>

        {showBomForm && (
          <form onSubmit={(e) => { void handleCreateBom(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 0 20px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={labelStyle}>{t('pages.technical.bom.version')}</label>
                <input value={bomVersion} onChange={(e) => setBomVersion(e.target.value)} required style={{ ...inputStyle, width: 100 }} />
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              <label style={{ ...labelStyle, fontWeight: 'bold', marginBottom: 10, display: 'block' }}>{t('pages.technical.bom.addItem')}</label>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>
                <span style={{ flex: 2 }}>{t('pages.technical.bom.item')}</span>
                <span style={{ width: 140 }}>{t('pages.technical.bom.plannedQty')}</span>
              </div>

              {bomLines.map((line, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
                  <select value={line.itemId} onChange={(e) => updateBomLine(idx, 'itemId', e.target.value)} style={{ ...inputStyle, flex: 2, minWidth: 200 }}>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                  </select>
                  <input type="number" min="0.01" step="any" value={line.plannedQuantity} onChange={(e) => updateBomLine(idx, 'plannedQuantity', e.target.value)} required style={{ ...inputStyle, width: 140 }} />
                </div>
              ))}

              <button type="button" onClick={addBomLine} className="filter-button" style={{ marginTop: 12 }}>+ {t('pages.technical.bom.addItem')}</button>
            </div>

            <button type="submit" disabled={submitting} className="primary-button" style={{ alignSelf: 'flex-start' }}>{t('pages.technical.form.save')}</button>
          </form>
        )}

        <div className="placeholder-table">
          <div className="placeholder-table__head">
            <span>{t('pages.technical.bom.version')}</span>
            <span>أمر التشغيل المرتبط</span>
            <span>{t('pages.technical.bom.status')}</span>
            <span>الإجراء</span>
          </div>
          {boms.filter((b) => b.jobOrderReference === selectedJO).length === 0 && (
            <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.technical.form.empty')}</p>
          )}
          {boms.filter((b) => b.jobOrderReference === selectedJO).map((bom) => (
            <div className="placeholder-table__row" key={bom.id}>
              <span><b>{bom.version}</b></span>
              <span><code>{bom.jobOrderReference}</code></span>
              <span><span className={`status status--${bom.status === 'approved' ? 'success' : 'neutral'}`}><i />{bom.status}</span></span>
              <span>
                {bom.status === 'draft' && (
                  <button className="primary-button" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { void handleApproveBom(bom.id); }}>
                    {t('pages.technical.bom.approve')}
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
