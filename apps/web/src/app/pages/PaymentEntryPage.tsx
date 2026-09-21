import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { financeApi, ApiError } from '../api/client';

export function PaymentEntryPage(): JSX.Element {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [orgNodeId, setOrgNodeId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paidFromAccountId, setPaidFromAccountId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await financeApi.getPayments();
      setPayments(data.payments ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'فشل تحميل بيانات المدفوعات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPayments(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financeApi.createPayment({
        orgNodeId, supplierId, amount, paymentMethod, paidFromAccountId, referenceNumber,
      });
      setShowForm(false);
      void loadPayments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إنشاء سند الصرف');
    }
  };

  const handlePost = async (id: string) => {
    try {
      await financeApi.postPayment(id);
      void loadPayments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل ترحيل سند الصرف');
    }
  };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">المحاسبة والمالية</span>
          <h1>سندات الصرف والمدفوعات</h1>
          <p>إدارة سداد مستحقات الموردين وترحيل القيود البنكية تلقائياً</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
          + سند صرف جديد
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {showForm && (
        <form className="form-card" onSubmit={handleSubmit}>
          <h3>إنشاء سند صرف جديد</h3>
          <div className="form-grid">
            <label>كود الشركة (orgNodeId)
              <input value={orgNodeId} onChange={(e) => setOrgNodeId(e.target.value)} required />
            </label>
            <label>كود المورد (supplierId)
              <input value={supplierId} onChange={(e) => setSupplierId(e.target.value)} />
            </label>
            <label>المبلغ (ج.م)
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </label>
            <label>طريقة الدفع
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="cash">نقدي</option>
                <option value="check">شيك</option>
              </select>
            </label>
            <label>حساب البنك / الخزنة (accountId)
              <input value={paidFromAccountId} onChange={(e) => setPaidFromAccountId(e.target.value)} required />
            </label>
            <label>رقم المرجع / الشيك
              <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary">حفظ السند</button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </form>
      )}

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>رقم السند</th>
              <th>التاريخ</th>
              <th>المبلغ</th>
              <th>طريقة الدفع</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}>جاري التحميل...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={6}>لا توجد سندات صرف مسجلة</td></tr>
            ) : (
              payments.map((p: any) => (
                <tr key={p.id}>
                  <td><b>{p.paymentNumber}</b></td>
                  <td>{new Date(p.paymentDate).toLocaleDateString('ar-EG')}</td>
                  <td>{Number(p.amount).toLocaleString('ar-EG')} ج.م</td>
                  <td>{p.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : p.paymentMethod === 'cash' ? 'نقدي' : 'شيك'}</td>
                  <td>
                    <span className={`status-badge status-badge--${p.status}`}>
                      {p.status === 'draft' ? 'مسودة' : p.status === 'posted' ? 'مرحل' : 'ملغي'}
                    </span>
                  </td>
                  <td>
                    {p.status === 'draft' && (
                      <button className="btn btn--sm btn--success" onClick={() => handlePost(p.id)}>
                        ترحيل
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