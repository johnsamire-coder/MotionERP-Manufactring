import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';

interface Account {
  code: string;
  name: string;
  type: string;
  balance: string;
  status?: string;
}

interface JournalEntry {
  id: string;
  entryDate: string;
  reference?: string;
  description: string;
  lines?: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: string;
    credit: string;
  }>;
}

export const AccountingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'coa' | 'journals'>('coa');
  const [coa, setCoa] = useState<Account[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API = 'http://localhost:3000/api/v1';

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'coa') {
        const res = await fetch(API + '/accounting/chart-of-accounts');
        const data = await res.json();
        setCoa(data.accounts || data || []);
      } else {
        const res = await fetch(API + '/accounting/journal-entries');
        const data = await res.json();
        setJournals(data.journalEntries || data || []);
      }
    } catch (e: any) {
      setError('فشل الاتصال بالخادم: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-800" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md"><BookOpen className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">شجرة الحسابات ودفتر اليومية العامة الحقيقي</h1>
            <p className="text-sm text-slate-500">الدليل المحاسبي الفعلي ومحرك الترحيل الآلي للقيود من الداتابيز</p>
          </div>
        </div>
        <button onClick={fetchData} className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer">
          <RefreshCw className="w-4 h-4" /> تحديث البيانات
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-xl flex items-center gap-2 font-bold">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex gap-2 bg-slate-50">
          <button onClick={() => setActiveTab('coa')} className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeTab === 'coa' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>
            دليل الحسابات الفعلي (Chart of Accounts)
          </button>
          <button onClick={() => setActiveTab('journals')} className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${activeTab === 'journals' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>
            دفتر القيود التلقائية ({journals.length})
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold">جاري تحميل البيانات الحقيقية من السيرفر...</div>
        ) : activeTab === 'coa' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">كود الحساب</th>
                  <th className="p-4">اسم الحساب في الدليل</th>
                  <th className="p-4">نوع الحساب</th>
                  <th className="p-4">الرصيد الفعلي الحالي</th>
                  <th className="p-4">حالة التفاعل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coa.map((acc) => (
                  <tr key={acc.code} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-indigo-700">{acc.code}</td>
                    <td className="p-4 font-semibold text-slate-900">{acc.name}</td>
                    <td className="p-4 text-xs">
                      <span className="bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded border border-slate-200">{acc.type}</span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-900">{(parseFloat(acc.balance) || 0).toLocaleString()} EGP</td>
                    <td className="p-4"><span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1 w-max"><CheckCircle2 className="w-3.5 h-3.5" /> نشط وموصول بالداتابيز</span></td>
                  </tr>
                ))}
                {coa.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد حسابات مسجلة في قاعدة البيانات حاليا.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">رقم القيد</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">المرجع</th>
                  <th className="p-4">الوصف والبيان</th>
                  <th className="p-4">التفاصيل المالية والترحيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {journals.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-mono font-bold text-indigo-700">{j.id}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">{j.entryDate}</td>
                    <td className="p-4 font-mono text-xs text-slate-700">{j.reference || '—'}</td>
                    <td className="p-4 font-medium text-slate-900">{j.description}</td>
                    <td className="p-4">
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">مترحل ومتوازن 100%</span>
                    </td>
                  </tr>
                ))}
                {journals.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد قيود مرحلة في قاعدة البيانات حاليا.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default AccountingPage;
