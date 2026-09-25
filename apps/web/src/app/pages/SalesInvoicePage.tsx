import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, financeApi, ApiError, type SalesInvoiceRecord } from '../api/client';

interface CustomerRecord {
  id: string;
  name: string;
}
interface ItemRecord {
  id: string;
  code: string;
  name: string;
}
interface InvoiceLineInput {
  itemId: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
}

export function SalesInvoicePage(): JSX.Element {
  const { t: _t, i18n } = useTranslation();
  const [invoices, setInvoices] = useState<SalesInvoiceRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [orgNodeId, _setOrgNodeId] = useState('00000000-0000-0000-0000-000000000001');
  const [customerId, setCustomerId] = useState('');
  const [jobOrderReference, setJobOrderReference] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [notes, _setNotes] = useState('');
  const [lines, setLines] = useState<InvoiceLineInput[]>([
    { itemId: '', quantity: '1', unitPrice: '0', taxRate: '14.00' },
  ]);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [invRes, custRes, itemRes] = await Promise.all([
        financeApi.getSalesInvoices().catch(() => ({ salesInvoices: [] })),
        api.get<{ customers: CustomerRecord[] }>('/crm/customers').catch(() => ({ customers: [] })),
        api
          .get<{ items: ItemRecord[] }>('/catalog/items?lang=' + lang)
          .catch(() => ({ items: [] })),
      ]);

      setInvoices(invRes.salesInvoices ?? []);
      setCustomers(custRes.customers ?? []);
      const itms = itemRes.items ?? [];
      setItems(itms);

      if (custRes.customers && custRes.customers[0] && !customerId) {
        setCustomerId(custRes.customers[0].id);
      }
      if (itms[0] && !lines[0]?.itemId) {
        setLines([{ itemId: itms[0].id, quantity: '1', unitPrice: '0', taxRate: '14.00' }]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل بيانات فواتير المبيعات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  const updateLine = (idx: number, field: keyof InvoiceLineInput, value: string) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx]!, [field]: value };
    setLines(updated);
  };

  const addLine = () => {
    setLines([
      ...lines,
      { itemId: items[0]?.id || '', quantity: '1', unitPrice: '0', taxRate: '14.00' },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== idx));
    }
  };

  // Calculations
  const netTotal = lines.reduce(
    (sum, l) => sum + Number(l.quantity || 0) * Number(l.unitPrice || 0),
    0,
  );
  const taxTotal = lines.reduce(
    (sum, l) =>
      sum + (Number(l.quantity || 0) * Number(l.unitPrice || 0) * Number(l.taxRate || 14)) / 100,
    0,
  );
  const grandTotal = netTotal + taxTotal;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);

      await financeApi.createSalesInvoice({
        orgNodeId,
        customerId,
        jobOrderReference: jobOrderReference.trim() || undefined,
        invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : new Date().toISOString(),
        dueDate: dueDate ? new Date(dueDate).toISOString() : nextMonth.toISOString(),
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
        })),
      });

      setSuccess('تم إنشاء فاتورة المبيعات بنجاح (مسودة جاهزة للمراجعة والترحيل)');
      setShowForm(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إنشاء الفاتورة');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost(id: string): Promise<void> {
    try {
      await financeApi.postSalesInvoice(id);
      setSuccess('تم ترحيل الفاتورة وتوليد قيود الإيراد وضريبة المخرجات ومديونية العميل بنجاح!');
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل ترحيل الفاتورة');
    }
  }

  const custName = (id: string) => customers.find((c) => c.id === id)?.name ?? id;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">المبيعات والعملاء</span>
          <h1>فواتير المبيعات (Sales Invoices)</h1>
          <p>إصدار الفواتير الضريبية للعملاء وترحيل الإيرادات وضريبة القيمة المضافة 14% تلقائياً</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'إلغاء' : '+ فاتورة مبيعات جديدة'}
        </button>
      </div>

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div className="alert alert--success" style={{ marginBottom: 16 }}>
          {success}
        </div>
      )}

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <h3>تسجيل فاتورة مبيعات ضريبية جديدة</h3>
          <div className="form-grid">
            <label>
              العميل
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              أمر الشغل المرتبط (Job Order)
              <input
                value={jobOrderReference}
                onChange={(e) => setJobOrderReference(e.target.value)}
                placeholder="مثال: JO-2026-000001"
              />
            </label>
            <label>
              تاريخ الفاتورة
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </label>
            <label>
              تاريخ الاستحقاق
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>

          <div
            style={{
              background: '#f8fafc',
              padding: 16,
              borderRadius: 8,
              marginTop: 16,
              border: '1px solid #e2e8f0',
            }}
          >
            <h4>بنود وأصناف الفاتورة</h4>
            {lines.map((line, idx) => (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '3fr 1fr 1.5fr 1fr 1.5fr auto',
                  gap: 12,
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <select
                  value={line.itemId}
                  onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                  required
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.code})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                  placeholder="الكمية"
                  required
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(idx, 'unitPrice', e.target.value)}
                  placeholder="سعر البيع"
                  required
                />
                <input
                  type="number"
                  step="any"
                  value={line.taxRate}
                  onChange={(e) => updateLine(idx, 'taxRate', e.target.value)}
                  placeholder="الضريبة %"
                />
                <b style={{ color: '#166534' }}>
                  {(
                    Number(line.quantity || 0) *
                    Number(line.unitPrice || 0) *
                    (1 + Number(line.taxRate || 14) / 100)
                  ).toFixed(2)}{' '}
                  ج.م
                </b>
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={() => removeLine(idx)}
                >
                  x
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--sm" onClick={addLine}>
              + إضافة صنف
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
              padding: '12px 16px',
              background: '#ecfdf5',
              borderRadius: 8,
            }}
          >
            <div>
              <span>
                الصافي: <b>{netTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</b>
              </span>{' '}
              |
              <span style={{ margin: '0 12px' }}>
                الضريبة (14%):{' '}
                <b>{taxTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</b>
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#166534' }}>
              الإجمالي شامل الضريبة:{' '}
              {grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="submit" disabled={submitting} className="btn btn--primary">
              {submitting ? 'جاري الحفظ...' : 'حفظ الفاتورة كمسودة'}
            </button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>
              إلغاء
            </button>
          </div>
        </form>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>رقم الفاتورة</th>
              <th>العميل</th>
              <th>التاريخ</th>
              <th>الصافي</th>
              <th>الضريبة 14%</th>
              <th>الإجمالي</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8}>جاري التحميل...</td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={8}>لا توجد فواتير مبيعات مسجلة</td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <b>{inv.invoiceNumber}</b>
                  </td>
                  <td>{custName(inv.customerId)}</td>
                  <td>{new Date(inv.invoiceDate).toLocaleDateString('ar-EG')}</td>
                  <td>{Number(inv.netAmount).toLocaleString('ar-EG')} ج.م</td>
                  <td>{Number(inv.taxAmount).toLocaleString('ar-EG')} ج.م</td>
                  <td>
                    <b>{Number(inv.grandTotal).toLocaleString('ar-EG')} ج.م</b>
                  </td>
                  <td>
                    <span
                      className={`status-badge status-badge--${inv.status === 'posted' ? 'active' : 'draft'}`}
                    >
                      {inv.status === 'posted' ? 'مرحل ومقيد' : 'مسودة'}
                    </span>
                  </td>
                  <td>
                    {inv.status === 'draft' && (
                      <button
                        className="btn btn--sm btn--success"
                        onClick={() => handlePost(inv.id)}
                      >
                        ترحيل بالدفاتر
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
