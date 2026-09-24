import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';

interface Option {
  id: string;
  label: string;
}
interface OrgTreeNode {
  id: string;
  name: string;
  nodeType: string;
  children: OrgTreeNode[];
}
interface FiscalYear {
  id: string;
  name: string;
  isClosed: boolean;
}
interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}
interface Settlement {
  id: string;
  settlementNumber: string;
  taxPeriod: string;
  outputVatAmount: string;
  inputVatAmount: string;
  netVatPayable: string;
  status: 'draft' | 'filed' | 'paid';
  paymentReference: string | null;
  paymentDate: string | null;
}
interface WhtEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  direction: 'deducted_by_us' | 'deducted_from_us';
  partnerName: string;
  invoiceNumber: string;
  baseAmount: string;
  whtRate: string;
  whtAmount: string;
  status: string;
}
interface Form41 {
  totalSuppliersCount: number;
  totalTaxableBase: string;
  totalWhtDeducted: string;
  goodsDeductionsTotal: string;
  servicesDeductionsTotal: string;
}
interface Declaration {
  id: string;
  declarationNumber: string;
  declarationDate: string;
  portName: string;
  supplierName: string;
  cifValueEgp: string;
  customsDutyAmount: string;
  developmentFee: string;
  clearanceExpenses: string;
  vatPaidAtCustoms: string;
  totalPaidAmount: string;
  status: 'draft' | 'cleared' | 'capitalized';
}
interface Movement {
  id: string;
  itemId: string;
  movementType: string;
  quantity: string;
  unitCost: string | null;
  movementDate: string;
}

type Tab = 'vat' | 'wht' | 'customs';

const input = 'mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
const label = 'block text-xs font-bold text-slate-600';
const button =
  'px-4 py-2 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const primary = `${button} bg-teal-600 hover:bg-teal-700 text-white`;
const card = 'bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4';
const money = (v: number | string): string =>
  Number(v).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const day = (iso: string | null): string => (iso ? iso.slice(0, 10) : '—');
const message = (err: unknown, fallback: string): string =>
  err instanceof ApiError ? err.message : fallback;

function companies(nodes: OrgTreeNode[]): Option[] {
  return nodes.flatMap((n) => [
    ...(n.nodeType === 'legal_company' ? [{ id: n.id, label: n.name }] : []),
    ...companies(n.children),
  ]);
}

function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  className?: string;
}): JSX.Element {
  return (
    <label className={`${label} ${props.className ?? ''}`}>
      {props.label}
      <select
        className={input}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">— اختر —</option>
        {props.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * الضرائب والجمارك على البيانات الحقيقية: إقرار ضريبة القيمة المضافة وسداده (بقيود حقيقية)،
 * وخصم المنبع نموذج 41، والإفراج الجمركي ورسملته على أذون الاستلام.
 */
export function TaxCustomsPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('vat');
  const [orgs, setOrgs] = useState<Option[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Array<Option & { name: string }>>([]);
  const [items, setItems] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [whts, setWhts] = useState<WhtEntry[]>([]);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);

  const period = periods.find((p) => p.id === periodId);
  const year = years.find((y) => y.id === yearId);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const [tree, acc, sup, itm] = await Promise.all([
          api.get<{ tree: OrgTreeNode[] }>('/organization/tree'),
          api.get<{
            accounts: Array<{ id: string; code: string; name: string; isLeaf: boolean }>;
          }>('/accounting/accounts'),
          api.get<{ suppliers: Array<{ id: string; code: string; name: string }> }>(
            '/crm/suppliers',
          ),
          api.get<{ items: Array<{ id: string; code: string; name: string }> }>(
            '/catalog/items?lang=ar',
          ),
        ]);
        const cos = companies(tree.tree);
        setOrgs(cos);
        if (cos[0]) setCompanyId(cos[0].id);
        setAccounts(
          acc.accounts
            .filter((a) => a.isLeaf)
            .map((a) => ({ id: a.id, label: `${a.code} — ${a.name}` })),
        );
        setSuppliers(
          sup.suppliers.map((s) => ({ id: s.id, label: `${s.code} — ${s.name}`, name: s.name })),
        );
        setItems(new Map(itm.items.map((i) => [i.id, `${i.code} — ${i.name}`])));
      } catch (err) {
        setError(message(err, 'فشل تحميل البيانات'));
      }
    })();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    void (async (): Promise<void> => {
      try {
        const fy = await api.get<{ fiscalYears: FiscalYear[] }>(
          `/accounting/fiscal-years?orgNodeId=${companyId}`,
        );
        setYears(fy.fiscalYears);
        const open = fy.fiscalYears.find((y) => !y.isClosed) ?? fy.fiscalYears[0];
        setYearId(open?.id ?? '');
        await loadLists();
      } catch (err) {
        setError(message(err, 'فشل تحميل السنوات المالية'));
      }
    })();
  }, [companyId]);

  useEffect(() => {
    if (!yearId) {
      setPeriods([]);
      return;
    }
    void api
      .get<{ periods: Period[] }>(`/accounting/fiscal-years/${yearId}/periods`)
      .then((r) => {
        setPeriods(r.periods);
        const open = r.periods.find((p) => p.status === 'open') ?? r.periods[0];
        setPeriodId(open?.id ?? '');
      })
      .catch((err: unknown) => setError(message(err, 'فشل تحميل الفترات')));
  }, [yearId]);

  async function loadLists(): Promise<void> {
    if (!companyId) return;
    const [s, w, d] = await Promise.all([
      api.get<Settlement[]>(`/accounting/tax-customs/vat/settlements?companyId=${companyId}`),
      api.get<WhtEntry[]>(`/accounting/tax-customs/wht?companyId=${companyId}`),
      api.get<Declaration[]>(`/accounting/tax-customs/customs?companyId=${companyId}`),
    ]);
    setSettlements(s);
    setWhts(w);
    setDeclarations(d);
  }

  async function run(action: () => Promise<string>, fallback: string): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      await loadLists();
    } catch (err) {
      setError(message(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  // ── VAT ──
  const [outVat, setOutVat] = useState('0');
  const [inVat, setInVat] = useState('0');
  const [salesBase, setSalesBase] = useState('0');
  const [purchaseBase, setPurchaseBase] = useState('0');
  const [authorityAccountId, setAuthorityAccountId] = useState('');
  const [payFor, setPayFor] = useState<Settlement | null>(null);
  const [bankAccountId, setBankAccountId] = useState('');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  async function fillFromBooks(): Promise<void> {
    if (!period || !companyId) return;
    try {
      const r = await api.get<{ totalOutputTax: string; totalInputTax: string }>(
        `/accounting/reports/vat-return?orgNodeId=${companyId}&startDate=${period.startDate}&endDate=${period.endDate}`,
      );
      setOutVat(r.totalOutputTax);
      setInVat(r.totalInputTax);
      setSalesBase((Number(r.totalOutputTax) / 0.14).toFixed(2));
      setPurchaseBase((Number(r.totalInputTax) / 0.14).toFixed(2));
      setNotice('اتملت الأرقام من الدفاتر للفترة المختارة — راجعها قبل التقديم');
    } catch (err) {
      setError(message(err, 'فشل حساب الضريبة من الدفاتر'));
    }
  }

  const fileReturn = (): Promise<void> =>
    run(async () => {
      const r = await api.post<{ settlement: Settlement; journalEntry: { entryNumber: string } }>(
        '/accounting/tax-customs/vat/settle',
        {
          companyId,
          fiscalYearId: yearId,
          periodId,
          taxPeriod: period?.name ?? '',
          totalSalesTaxable: Number(salesBase),
          outputVatAmount: Number(outVat),
          totalPurchaseTaxable: Number(purchaseBase),
          inputVatAmount: Number(inVat),
          vatPayableAccountId: authorityAccountId,
          settlementDate: period ? day(period.endDate) : undefined,
        },
      );
      return `اتقدّم الإقرار ${r.settlement.settlementNumber} واترحّل القيد ${r.journalEntry.entryNumber}`;
    }, 'فشل تقديم الإقرار');

  const payVat = (): Promise<void> =>
    run(async () => {
      if (!payFor) return '';
      const r = await api.post<{ paymentJournal: { entryNumber: string } }>(
        '/accounting/tax-customs/vat/pay',
        {
          settlementId: payFor.id,
          paymentDate: payDate,
          paymentReference: payRef,
          bankAccountId,
        },
      );
      setPayFor(null);
      return `اتسدد ${payFor.settlementNumber} — القيد ${r.paymentJournal.entryNumber}`;
    }, 'فشل السداد');

  // ── WHT ──
  const [whtDirection, setWhtDirection] = useState<WhtEntry['direction']>('deducted_by_us');
  const [whtPartnerId, setWhtPartnerId] = useState('');
  const [whtTaxReg, setWhtTaxReg] = useState('');
  const [whtInvoice, setWhtInvoice] = useState('');
  const [whtDate, setWhtDate] = useState(new Date().toISOString().slice(0, 10));
  const [whtBase, setWhtBase] = useState('');
  const [whtRate, setWhtRate] = useState('1');
  const [form41, setForm41] = useState<Form41 | null>(null);
  const quarterOf = (iso: string): number => Math.floor(Number(iso.slice(5, 7)) / 3.01) + 1;
  const [summaryQuarter, setSummaryQuarter] = useState(quarterOf(new Date().toISOString()));

  const addWht = (): Promise<void> =>
    run(async () => {
      const partner = suppliers.find((s) => s.id === whtPartnerId);
      await api.post('/accounting/tax-customs/wht', {
        companyId,
        fiscalYearId: yearId,
        quarter: quarterOf(whtDate),
        entryDate: whtDate,
        direction: whtDirection,
        partnerId: whtPartnerId,
        partnerName: partner?.name ?? '',
        taxRegistrationNum: whtTaxReg,
        invoiceNumber: whtInvoice,
        baseAmount: Number(whtBase),
        whtRate: Number(whtRate),
      });
      setWhtBase('');
      setWhtInvoice('');
      return 'اتسجل خصم المنبع';
    }, 'فشل تسجيل خصم المنبع');

  async function loadForm41(): Promise<void> {
    try {
      setForm41(
        await api.get<Form41>(
          `/accounting/tax-customs/wht/form41-summary?companyId=${companyId}&year=${year?.name.match(/\d{4}/)?.[0] ?? new Date().getFullYear()}&quarter=${summaryQuarter}`,
        ),
      );
    } catch (err) {
      setError(message(err, 'فشل تحميل ملخص نموذج 41'));
    }
  }

  // ── Customs ──
  const [dn, setDn] = useState('');
  const [dDate, setDDate] = useState(new Date().toISOString().slice(0, 10));
  const [port, setPort] = useState('');
  const [bl, setBl] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [rate, setRate] = useState('');
  const [cif, setCif] = useState('');
  const [duty, setDuty] = useState('0');
  const [devFee, setDevFee] = useState('0');
  const [clearance, setClearance] = useState('0');
  const [portVat, setPortVat] = useState('0');
  const [clearingAccountId, setClearingAccountId] = useState('');
  const [paidFromAccountId, setPaidFromAccountId] = useState('');
  const [capFor, setCapFor] = useState<Declaration | null>(null);
  const [receipts, setReceipts] = useState<Movement[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  const addDeclaration = (): Promise<void> =>
    run(async () => {
      const r = await api.post<{ declaration: Declaration; journalEntry: { entryNumber: string } }>(
        '/accounting/tax-customs/customs',
        {
          companyId,
          fiscalYearId: yearId,
          periodId,
          declarationNumber: dn,
          declarationDate: dDate,
          portName: port,
          billOfLading: bl,
          supplierName,
          currency,
          exchangeRate: Number(rate),
          cifValueForeign: Number(cif),
          customsDutyAmount: Number(duty),
          developmentFee: Number(devFee),
          clearanceExpenses: Number(clearance),
          vatPaidAtCustoms: Number(portVat),
          customsClearingAccountId: clearingAccountId,
          paidFromAccountId,
        },
      );
      setDn('');
      return `اتسجل الإفراج ${r.declaration.declarationNumber} — القيد ${r.journalEntry.entryNumber}`;
    }, 'فشل تسجيل الإفراج');

  async function openCapitalize(d: Declaration): Promise<void> {
    setCapFor(d);
    setPicked([]);
    try {
      const r = await api.get<{ movements: Movement[] }>('/inventory/movements');
      setReceipts(
        r.movements
          .filter((m) => m.movementType === 'receipt')
          .sort((a, b) => b.movementDate.localeCompare(a.movementDate))
          .slice(0, 50),
      );
    } catch (err) {
      setError(message(err, 'فشل تحميل أذون الاستلام'));
    }
  }

  const capitalize = (): Promise<void> =>
    run(async () => {
      if (!capFor) return '';
      await api.post('/accounting/tax-customs/customs/capitalize', {
        declarationId: capFor.id,
        receiptMovementIds: picked,
      });
      setCapFor(null);
      return `اترسملت جمارك ${capFor.declarationNumber} على ${picked.length} إذن استلام`;
    }, 'فشل الرسملة');

  const periodOptions = useMemo(
    () => periods.map((p) => ({ id: p.id, label: `${p.name} (${p.status})` })),
    [periods],
  );
  const tabs: Array<[Tab, string]> = [
    ['vat', 'ضريبة القيمة المضافة'],
    ['wht', 'خصم المنبع (نموذج 41)'],
    ['customs', 'الجمارك'],
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className={card}>
        <h1 className="text-2xl font-bold text-slate-900">الضرائب والجمارك</h1>
        <p className="text-sm text-slate-500">
          كل تقديم وسداد وإفراج بيترحّل بقيد حقيقي في الدفاتر، والجمارك بتترسمل على تكلفة الأصناف.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select label="الشركة" value={companyId} onChange={setCompanyId} options={orgs} />
          <Select
            label="السنة المالية"
            value={yearId}
            onChange={setYearId}
            options={years.map((y) => ({ id: y.id, label: y.name }))}
          />
          <Select label="الفترة" value={periodId} onChange={setPeriodId} options={periodOptions} />
        </div>
        <div className="flex gap-2 border-b border-slate-200">
          {tabs.map(([id, text]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm font-bold cursor-pointer ${tab === id ? 'border-b-2 border-teal-600 text-teal-700' : 'text-slate-500'}`}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm bg-rose-50 text-rose-700 border border-rose-200 rounded-xl p-3">
          {error}
        </div>
      )}
      {notice && (
        <div className="text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl p-3">
          {notice}
        </div>
      )}

      {tab === 'vat' && (
        <>
          <div className={card}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">إقرار الفترة {period?.name ?? ''}</h2>
              <button
                className={`${button} border border-slate-300 hover:bg-slate-100`}
                disabled={!period}
                onClick={() => void fillFromBooks()}
              >
                احسب من الدفاتر
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className={label}>
                المبيعات الخاضعة
                <input
                  className={input}
                  value={salesBase}
                  onChange={(e) => setSalesBase(e.target.value)}
                />
              </label>
              <label className={label}>
                ضريبة المخرجات
                <input
                  className={input}
                  value={outVat}
                  onChange={(e) => setOutVat(e.target.value)}
                />
              </label>
              <label className={label}>
                المشتريات الخاضعة
                <input
                  className={input}
                  value={purchaseBase}
                  onChange={(e) => setPurchaseBase(e.target.value)}
                />
              </label>
              <label className={label}>
                ضريبة المدخلات
                <input className={input} value={inVat} onChange={(e) => setInVat(e.target.value)} />
              </label>
            </div>
            <div className="flex flex-col md:flex-row gap-3 md:items-end">
              <Select
                className="flex-1"
                label="حساب مصلحة الضرائب (الصافي بيتقفل عليه)"
                value={authorityAccountId}
                onChange={setAuthorityAccountId}
                options={accounts}
              />
              <div className="text-sm pb-2">
                الصافي: <b>{money(Number(outVat) - Number(inVat))} ج.م</b>{' '}
                {Number(outVat) - Number(inVat) < 0 ? '(مسترد)' : '(مستحق)'}
              </div>
              <button
                className={primary}
                disabled={busy || !periodId || !authorityAccountId}
                onClick={() => void fileReturn()}
              >
                تقديم الإقرار وترحيله
              </button>
            </div>
          </div>

          {payFor && (
            <div className={`${card} border-sky-300`}>
              <h2 className="text-lg font-bold">سداد {payFor.settlementNumber}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  label="البنك / الخزينة"
                  value={bankAccountId}
                  onChange={setBankAccountId}
                  options={accounts}
                />
                <label className={label}>
                  مرجع السداد
                  <input
                    className={input}
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                  />
                </label>
                <label className={label}>
                  تاريخ السداد
                  <input
                    type="date"
                    className={input}
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </label>
              </div>
              <button
                className={primary}
                disabled={busy || !bankAccountId || !payRef}
                onClick={() => void payVat()}
              >
                سداد {money(payFor.netVatPayable)} ج.م
              </button>
            </div>
          )}

          <div className={card}>
            <h2 className="text-lg font-bold">الإقرارات ({settlements.length})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-200">
                  <th className="text-right py-2">الرقم</th>
                  <th className="text-right py-2">الفترة</th>
                  <th className="text-right py-2">المخرجات</th>
                  <th className="text-right py-2">المدخلات</th>
                  <th className="text-right py-2">الصافي</th>
                  <th className="text-right py-2">الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-2">{s.settlementNumber}</td>
                    <td className="py-2">{s.taxPeriod}</td>
                    <td className="py-2">{money(s.outputVatAmount)}</td>
                    <td className="py-2">{money(s.inputVatAmount)}</td>
                    <td className="py-2 font-bold">{money(s.netVatPayable)}</td>
                    <td className="py-2">
                      {s.status === 'paid' ? `مسدد ${day(s.paymentDate)}` : 'مقدَّم'}
                    </td>
                    <td className="py-2 text-left">
                      {s.status === 'filed' && Number(s.netVatPayable) > 0 && (
                        <button className={primary} onClick={() => setPayFor(s)}>
                          سداد
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'wht' && (
        <>
          <div className={card}>
            <h2 className="text-lg font-bold">تسجيل خصم منبع</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className={label}>
                الاتجاه
                <select
                  className={input}
                  value={whtDirection}
                  onChange={(e) => setWhtDirection(e.target.value as WhtEntry['direction'])}
                >
                  <option value="deducted_by_us">خصمناه من مورد</option>
                  <option value="deducted_from_us">اتخصم مننا</option>
                </select>
              </label>
              <Select
                label="الطرف"
                value={whtPartnerId}
                onChange={setWhtPartnerId}
                options={suppliers}
              />
              <label className={label}>
                رقم التسجيل الضريبي
                <input
                  className={input}
                  value={whtTaxReg}
                  onChange={(e) => setWhtTaxReg(e.target.value)}
                />
              </label>
              <label className={label}>
                رقم الفاتورة
                <input
                  className={input}
                  value={whtInvoice}
                  onChange={(e) => setWhtInvoice(e.target.value)}
                />
              </label>
              <label className={label}>
                التاريخ
                <input
                  type="date"
                  className={input}
                  value={whtDate}
                  onChange={(e) => setWhtDate(e.target.value)}
                />
              </label>
              <label className={label}>
                المبلغ الخاضع
                <input
                  className={input}
                  value={whtBase}
                  onChange={(e) => setWhtBase(e.target.value)}
                />
              </label>
              <label className={label}>
                النسبة
                <select
                  className={input}
                  value={whtRate}
                  onChange={(e) => setWhtRate(e.target.value)}
                >
                  <option value="1">1% (توريدات)</option>
                  <option value="3">3% (خدمات)</option>
                  <option value="5">5% (مهن حرة)</option>
                </select>
              </label>
              <div className="flex items-end">
                <button
                  className={primary}
                  disabled={
                    busy || !whtPartnerId || !whtTaxReg || !whtInvoice || !(Number(whtBase) > 0)
                  }
                  onClick={() => void addWht()}
                >
                  تسجيل ({money(((Number(whtBase) || 0) * Number(whtRate)) / 100)} ج.م)
                </button>
              </div>
            </div>
          </div>

          <div className={card}>
            <div className="flex flex-wrap gap-3 items-end">
              <h2 className="text-lg font-bold flex-1">ملخص نموذج 41</h2>
              <label className={label}>
                الربع
                <select
                  className={input}
                  value={summaryQuarter}
                  onChange={(e) => setSummaryQuarter(Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      الربع {q}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={`${button} border border-slate-300 hover:bg-slate-100`}
                onClick={() => void loadForm41()}
              >
                اعرض
              </button>
            </div>
            {form41 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                {[
                  ['عدد الموردين', String(form41.totalSuppliersCount)],
                  ['الوعاء الخاضع', money(form41.totalTaxableBase)],
                  ['إجمالي المخصوم', money(form41.totalWhtDeducted)],
                  ['توريدات 1%', money(form41.goodsDeductionsTotal)],
                  ['خدمات 3%', money(form41.servicesDeductionsTotal)],
                ].map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-slate-50">
                    <div className="text-xs text-slate-500">{k}</div>
                    <div className="font-bold">{v}</div>
                  </div>
                ))}
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-200">
                  <th className="text-right py-2">التاريخ</th>
                  <th className="text-right py-2">الطرف</th>
                  <th className="text-right py-2">الفاتورة</th>
                  <th className="text-right py-2">الوعاء</th>
                  <th className="text-right py-2">النسبة</th>
                  <th className="text-right py-2">المخصوم</th>
                  <th className="text-right py-2">الاتجاه</th>
                </tr>
              </thead>
              <tbody>
                {whts.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100">
                    <td className="py-2">{day(w.entryDate)}</td>
                    <td className="py-2">{w.partnerName}</td>
                    <td className="py-2">{w.invoiceNumber}</td>
                    <td className="py-2">{money(w.baseAmount)}</td>
                    <td className="py-2">{Number(w.whtRate)}%</td>
                    <td className="py-2 font-bold">{money(w.whtAmount)}</td>
                    <td className="py-2">
                      {w.direction === 'deducted_by_us' ? 'خصمناه' : 'اتخصم مننا'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'customs' && (
        <>
          <div className={card}>
            <h2 className="text-lg font-bold">إفراج جمركي جديد (46 ك.م)</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(
                [
                  ['رقم الإفراج', dn, setDn],
                  ['الميناء', port, setPort],
                  ['بوليصة الشحن', bl, setBl],
                  ['المورد الأجنبي', supplierName, setSupplierName],
                  ['العملة', currency, setCurrency],
                  ['سعر الصرف', rate, setRate],
                  ['قيمة CIF بالعملة', cif, setCif],
                  ['الرسوم الجمركية', duty, setDuty],
                  ['رسم التنمية', devFee, setDevFee],
                  ['مصاريف التخليص', clearance, setClearance],
                  ['ضريبة القيمة المضافة بالميناء', portVat, setPortVat],
                ] as Array<[string, string, (v: string) => void]>
              ).map(([text, value, set]) => (
                <label key={text} className={label}>
                  {text}
                  <input className={input} value={value} onChange={(e) => set(e.target.value)} />
                </label>
              ))}
              <label className={label}>
                تاريخ الإفراج
                <input
                  type="date"
                  className={input}
                  value={dDate}
                  onChange={(e) => setDDate(e.target.value)}
                />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="حساب الجمارك تحت التسوية (لحد الرسملة)"
                value={clearingAccountId}
                onChange={setClearingAccountId}
                options={accounts}
              />
              <Select
                label="اتدفعت من (بنك / خزينة)"
                value={paidFromAccountId}
                onChange={setPaidFromAccountId}
                options={accounts}
              />
            </div>
            <button
              className={primary}
              disabled={
                busy ||
                !dn ||
                !port ||
                !bl ||
                !supplierName ||
                !(Number(rate) > 0) ||
                !(Number(cif) > 0) ||
                !clearingAccountId ||
                !paidFromAccountId ||
                !periodId
              }
              onClick={() => void addDeclaration()}
            >
              تسجيل وترحيل (
              {money(Number(duty) + Number(devFee) + Number(clearance) + Number(portVat))} ج.م)
            </button>
          </div>

          {capFor && (
            <div className={`${card} border-sky-300`}>
              <h2 className="text-lg font-bold">
                رسملة {capFor.declarationNumber} على أذون الاستلام
              </h2>
              <p className="text-sm text-slate-500">
                اختار أذون استلام البضاعة المستوردة؛ الرسوم بتتوزع عليها بالقيمة وبتدخل في تكلفة
                الأصناف.
              </p>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
                {receipts.map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={picked.includes(m.id)}
                      onChange={(e) =>
                        setPicked(
                          e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id),
                        )
                      }
                    />
                    <span className="flex-1">{items.get(m.itemId) ?? m.itemId.slice(0, 8)}</span>
                    <span>
                      {Number(m.quantity)} × {money(m.unitCost ?? 0)}
                    </span>
                    <span className="text-slate-400">{day(m.movementDate)}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  className={primary}
                  disabled={busy || picked.length === 0}
                  onClick={() => void capitalize()}
                >
                  تنفيذ الرسملة
                </button>
                <button
                  className={`${button} border border-slate-300 hover:bg-slate-100`}
                  onClick={() => setCapFor(null)}
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          <div className={card}>
            <h2 className="text-lg font-bold">الإفراجات ({declarations.length})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-200">
                  <th className="text-right py-2">الرقم</th>
                  <th className="text-right py-2">التاريخ</th>
                  <th className="text-right py-2">الميناء / المورد</th>
                  <th className="text-right py-2">CIF (ج.م)</th>
                  <th className="text-right py-2">الرسوم</th>
                  <th className="text-right py-2">الإجمالي المدفوع</th>
                  <th className="text-right py-2">الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {declarations.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="py-2">{d.declarationNumber}</td>
                    <td className="py-2">{day(d.declarationDate)}</td>
                    <td className="py-2">
                      {d.portName} / {d.supplierName}
                    </td>
                    <td className="py-2">{money(d.cifValueEgp)}</td>
                    <td className="py-2">
                      {money(
                        Number(d.customsDutyAmount) +
                          Number(d.developmentFee) +
                          Number(d.clearanceExpenses),
                      )}
                    </td>
                    <td className="py-2 font-bold">{money(d.totalPaidAmount)}</td>
                    <td className="py-2">
                      {d.status === 'capitalized' ? 'اترسمل على المخزون' : 'مُفرَج عنه'}
                    </td>
                    <td className="py-2 text-left">
                      {d.status === 'cleared' && (
                        <button className={primary} onClick={() => void openCapitalize(d)}>
                          رسملة
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default TaxCustomsPage;
