import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

type QualityTab = 'inspections' | 'checkpoints';

interface ItemRecord { id: string; code: string; name: string; }
interface QualityInspectionParameter {
  id: string;
  parameterName: string;
  targetValue: string;
  actualValue: string | null;
  status: 'pending' | 'pass' | 'fail';
}

interface QualityInspectionRecord {
  id: string;
  inspectionNumber: string;
  itemId: string;
  referenceType: string;
  referenceId: string;
  status: 'pending' | 'passed' | 'failed';
  inspectedBy: string | null;
  inspectedAt: string | null;
  notes: string | null;
  parameters: QualityInspectionParameter[];
}

export function QualityPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<QualityTab>('inspections');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [items, setItems] = useState<ItemRecord[]>([]);
  const [inspections, setInspections] = useState<QualityInspectionRecord[]>([]);
  const [checkPoints, setCheckPoints] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);

  // Create Inspection Form State
  const [showInspForm, setShowInspForm] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [refType, setRefType] = useState<'purchase_receipt' | 'production_step' | 'delivery_order'>('production_step');
  const [refId, setRefId] = useState('00000000-0000-0000-0000-000000000001');
  const [notes, setNotes] = useState('');
  const [parameters, setParameters] = useState<Array<{ parameterName: string; targetValue: string }>>([
    { parameterName: 'سماكة الصاج المجلفن', targetValue: '1.2 mm' },
    { parameterName: 'أبعاد الهيكل الخارجي', targetValue: '60 cm x 50 cm' },
    { parameterName: 'درجة نقاء وتغطية الدهان', targetValue: '85%' },
  ]);

  // Evaluate Modal State
  const [evaluatingInsp, setEvaluatingInsp] = useState<QualityInspectionRecord | null>(null);
  const [inspectorName, setInspectorName] = useState('م. أحمد سامي (مهندس الجودة)');
  const [evalParams, setEvalParams] = useState<Array<{ parameterId: string; actualValue: string; status: 'pass' | 'fail' }>>([]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemRes, cpRes, wfRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang).catch(() => ({ items: [] })),
        api.get<any>('/quality/check-points').catch(() => ({ checkPoints: [] })),
        api.get<any>('/quality/workflows').catch(() => ({ workflows: [] })),
      ]);

      const itms = itemRes.items ?? [];
      setItems(itms);
      if (itms[0] && !selectedItemId) setSelectedItemId(itms[0].id);

      setCheckPoints(Array.isArray(cpRes) ? cpRes : (cpRes?.checkPoints ?? []));
      setWorkflows(Array.isArray(wfRes) ? wfRes : (wfRes?.workflows ?? []));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل بيانات الجودة');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  const addParam = () => {
    setParameters([...parameters, { parameterName: '', targetValue: '' }]);
  };

  const removeParam = (idx: number) => {
    if (parameters.length > 1) {
      setParameters(parameters.filter((_, i) => i !== idx));
    }
  };

  const updateParam = (idx: number, field: 'parameterName' | 'targetValue', val: string) => {
    const updated = [...parameters];
    updated[idx] = { ...updated[idx]!, [field]: val };
    setParameters(updated);
  };

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post<{ qualityInspection: QualityInspectionRecord }>('/quality/inspections', {
        orgNodeId: '00000000-0000-0000-0000-000000000001',
        itemId: selectedItemId,
        referenceType: refType,
        referenceId: refId,
        notes: notes.trim() || undefined,
        parameters,
      });
      const created = res.qualityInspection ?? res;
      setInspections([created as any, ...inspections]);
      setShowInspForm(false);
      setSuccess('تم إنشاء مستند الفحص الفني بنجاح');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إنشاء مستند الفحص');
    }
  };

  const openEvaluation = (insp: QualityInspectionRecord) => {
    setEvaluatingInsp(insp);
    setEvalParams(
      insp.parameters.map((p) => ({
        parameterId: p.id,
        actualValue: p.targetValue,
        status: 'pass',
      })),
    );
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingInsp) return;
    try {
      await api.post(`/quality/inspections/${evaluatingInsp.id}/evaluate`, {
        inspectedBy: inspectorName,
        paramResults: evalParams,
      });

      // Update local state
      const hasFailure = evalParams.some((p) => p.status === 'fail');
      const updatedList = inspections.map((insp) => {
        if (insp.id === evaluatingInsp.id) {
          return {
            ...insp,
            status: (hasFailure ? 'failed' : 'passed') as any,
            inspectedBy: inspectorName,
            inspectedAt: new Date().toISOString(),
          };
        }
        return insp;
      });
      setInspections(updatedList);
      setEvaluatingInsp(null);
      setSuccess(hasFailure ? 'تم رفض العينة طبياً لعدم مطابقة المعايير!' : 'تم اعتماد وقبول العينة الطبية بنجاح!');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل اعتماد نتيجة الفحص');
    }
  };

  const itemName = (id: string) => items.find((it) => it.id === id)?.name ?? id;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">إدارة الجودة والتفتيش الطبي</span>
          <h1>لوحة تحكم الجودة الطبية (Quality Assurance)</h1>
          <p>فحص العينات الطبية الواردة والمنتجة والتأكد من مطابقة المعايير الفنية بدقة بالغة</p>
        </div>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginBottom: 16 }}>{success}</div>}

      {/* Tabs */}
      <div className="tab-nav" style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        <button className={`btn ${activeTab === 'inspections' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('inspections')}>
          🔬 مستندات الفحص الفني الطبي ({inspections.length})
        </button>
        <button className={`btn ${activeTab === 'checkpoints' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setActiveTab('checkpoints')}>
          ⏱️ نقاط المراقبة ومواقيت الـ SLA
        </button>
      </div>

      {/* Tab 1: Inspections */}
      {activeTab === 'inspections' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">فحص العينات والمنتجات</span>
              <h2>سجل الفحص الطبي (Medical Quality Inspections)</h2>
            </div>
            <button className="btn btn--primary" onClick={() => setShowInspForm(!showInspForm)}>
              + مستند فحص عينة جديد
            </button>
          </div>

          {showInspForm && (
            <form className="form-card" onSubmit={handleCreateInspection} style={{ marginBottom: 24 }}>
              <h3>تسجيل مستند فحص فني جديد</h3>
              <div className="form-grid">
                <label>الصنف المراد فحصه
                  <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} required>
                    {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
                  </select>
                </label>
                <label>نوع الحركة المرتبطة
                  <select value={refType} onChange={(e) => setRefType(e.target.value as any)}>
                    <option value="production_step">مرحلة إنتاج / أمر شغل</option>
                    <option value="purchase_receipt">استلام مشتريات خامات</option>
                    <option value="delivery_order">إذن تسليم منتج تام</option>
                  </select>
                </label>
                <label>ملاحظات الفحص
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثال: فحص عينة وحدة درج وضلفة 60" />
                </label>
              </div>

              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginTop: 16, border: '1px solid #e2e8f0' }}>
                <h4>معايير الفحص الفنية المطلوبة</h4>
                {parameters.map((p, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr auto', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                    <input value={p.parameterName} onChange={(e) => updateParam(idx, 'parameterName', e.target.value)} placeholder="اسم المعيار (مثال: سماكة الصاج)" required />
                    <input value={p.targetValue} onChange={(e) => updateParam(idx, 'targetValue', e.target.value)} placeholder="القيمة المعيارية (مثال: 1.2 mm)" required />
                    <button type="button" className="btn btn--sm btn--danger" onClick={() => removeParam(idx)}>x</button>
                  </div>
                ))}
                <button type="button" className="btn btn--sm" onClick={addParam}>+ إضافة معيار فني</button>
              </div>

              <div className="form-actions" style={{ marginTop: 16 }}>
                <button type="submit" className="btn btn--primary">حفظ مستند الفحص</button>
                <button type="button" className="btn" onClick={() => setShowInspForm(false)}>إلغاء</button>
              </div>
            </form>
          )}

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الفحص</th>
                  <th>الصنف</th>
                  <th>نوع الحركة</th>
                  <th>المفتش المسؤول</th>
                  <th>الحالة والقرار</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {inspections.length === 0 ? (
                  <tr><td colSpan={6}>لا توجد مستندات فحص مسجلة</td></tr>
                ) : (
                  inspections.map((insp) => (
                    <tr key={insp.id}>
                      <td><b>{insp.inspectionNumber}</b></td>
                      <td>{itemName(insp.itemId)}</td>
                      <td>{insp.referenceType === 'production_step' ? 'خط إنتاج' : insp.referenceType === 'purchase_receipt' ? 'استلام خامات' : 'إذن تسليم'}</td>
                      <td>{insp.inspectedBy ?? 'بانتظار الفحص'}</td>
                      <td>
                        <span className={`status-badge status-badge--${insp.status === 'passed' ? 'active' : insp.status === 'failed' ? 'cancelled' : 'draft'}`}>
                          {insp.status === 'passed' ? 'مقبول ومطابق ✅' : insp.status === 'failed' ? 'مرفوض طبياً ❌' : 'قيد الفحص'}
                        </span>
                      </td>
                      <td>
                        {insp.status === 'pending' && (
                          <button className="btn btn--sm btn--primary" onClick={() => openEvaluation(insp)}>
                            فحص وتقييم العينة 🔬
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Tab 2: Checkpoints & SLAs */}
      {activeTab === 'checkpoints' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">مراقبة خطوط الإنتاج</span>
              <h2>نقاط المراقبة وسير العمل (SLA Workflows)</h2>
            </div>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم نقطة المراقبة</th>
                  <th>الوقت المستهدف</th>
                  <th>فترة السماح</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {checkPoints.length === 0 ? (
                  <tr><td colSpan={4}>لا توجد نقاط مراقبة مسجلة</td></tr>
                ) : (
                  checkPoints.map((cp) => (
                    <tr key={cp.id}>
                      <td><b>{cp.name}</b></td>
                      <td>{cp.targetDurationMinutes} دقيقة</td>
                      <td>{cp.gracePeriodMinutes} دقيقة</td>
                      <td><span className="status-badge status-badge--active">نشط</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Evaluation Modal */}
      {evaluatingInsp && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 550, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>فحص وتقييم مستند الجودة: {evaluatingInsp.inspectionNumber}</h3>
            <p style={{ color: '#64748b', fontSize: 13 }}>الصنف: <b>{itemName(evaluatingInsp.itemId)}</b></p>
            <form onSubmit={handleSaveEvaluation} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
              <label>اسم مهندس الجودة
                <input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} required />
              </label>

              <h4>نتائج القياس الفعلية للمعاير:</h4>
              {evalParams.map((param, idx) => {
                const origParam = evaluatingInsp.parameters.find((p) => p.id === param.parameterId);
                return (
                  <div key={idx} style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <b>{origParam?.parameterName}</b>
                      <span style={{ fontSize: 12, color: '#64748b' }}>المعيار المطلوب: {origParam?.targetValue}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                      <input
                        value={param.actualValue}
                        onChange={(e) => {
                          const updated = [...evalParams];
                          updated[idx]!.actualValue = e.target.value;
                          setEvalParams(updated);
                        }}
                        placeholder="القياس الفعلي"
                        required
                      />
                      <select
                        value={param.status}
                        onChange={(e) => {
                          const updated = [...evalParams];
                          updated[idx]!.status = e.target.value as any;
                          setEvalParams(updated);
                        }}
                        style={{ fontWeight: 'bold', color: param.status === 'pass' ? '#166534' : '#b91c1c' }}
                      >
                        <option value="pass">مطابق (Pass) ✅</option>
                        <option value="fail">معيب (Fail) ❌</option>
                      </select>
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn" onClick={() => setEvaluatingInsp(null)}>إلغاء</button>
                <button type="submit" className="btn btn--primary">اعتماد وحفظ القرار النهائي</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}