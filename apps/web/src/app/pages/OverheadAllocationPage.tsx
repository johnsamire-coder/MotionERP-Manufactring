import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface OrgNode { id: string; name: string; }
interface OverheadPool {
  id: string;
  code: string;
  name: string;
  poolType: 'manufacturing_overhead' | 'administrative' | 'selling_marketing';
  periodStart: string;
  periodEnd: string;
  totalAmount: string;
  currencyCode: string;
  status: 'draft' | 'active' | 'allocated' | 'closed';
  orgNodeId: string | null;
}

interface OverheadPoolEntry {
  id: string;
  poolId: string;
  description: string;
  amount: string;
  sourceReference: string | null;
  recordedAt: string;
}

interface AllocationPolicy {
  id: string;
  code: string;
  name: string;
  poolId: string;
  allocationBase: 'units_produced' | 'direct_labor_hours' | 'direct_labor_cost' | 'machine_hours' | 'direct_material_cost' | 'sales_revenue';
  percentage: string;
  isActive: string;
}

interface AllocationResult {
  id: string;
  policyId: string;
  workOrderId: string | null;
  jobOrderReference: string | null;
  allocatedAmount: string;
  baseQuantity: string;
  baseRate: string;
  periodStart: string;
  periodEnd: string;
  allocatedAt: string;
}

interface AllocationExecutionSummary {
  policyId: string;
  policyName: string;
  poolName: string;
  allocationBase: string;
  totalPoolAmount: string;
  percentageApplied: string;
  amountToAllocate: string;
  totalBaseQuantity: string;
  baseRate: string;
  workOrdersAffected: number;
  results: AllocationResult[];
}

export function OverheadAllocationPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState<'pools' | 'policies' | 'run'>('pools');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([]);
  const [pools, setPools] = useState<OverheadPool[]>([]);
  const [policies, setPolicies] = useState<AllocationPolicy[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [poolEntries, setPoolEntries] = useState<OverheadPoolEntry[]>([]);

  // Form states: Create Pool
  const [showPoolForm, setShowPoolForm] = useState(false);
  const [poolCode, setPoolCode] = useState('');
  const [poolName, setPoolName] = useState('');
  const [poolType, setPoolType] = useState<'manufacturing_overhead' | 'administrative' | 'selling_marketing'>('manufacturing_overhead');
  const [periodStart, setPeriodStart] = useState('2026-09-01T00:00:00Z');
  const [periodEnd, setPeriodEnd] = useState('2026-09-30T23:59:59Z');
  const [poolOrgNodeId, setPoolOrgNodeId] = useState('');

  // Form states: Add Entry
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryDesc, setEntryDesc] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryRef, setEntryRef] = useState('');

  // Form states: Create Policy
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [policyCode, setPolicyCode] = useState('');
  const [policyName, setPolicyName] = useState('');
  const [policyPoolId, setPolicyPoolId] = useState('');
  const [policyBase, setPolicyBase] = useState<'units_produced' | 'direct_labor_hours' | 'direct_labor_cost' | 'machine_hours' | 'direct_material_cost' | 'sales_revenue'>('units_produced');
  const [policyPercentage, setPolicyPercentage] = useState('100');
  const [policyOrgNodeId, setPolicyOrgNodeId] = useState('');

  // Execution states
  const [execPolicyId, setExecPolicyId] = useState('');
  const [executing, setExecuting] = useState(false);
  const [lastSummary, setLastSummary] = useState<AllocationExecutionSummary | null>(null);

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [nodesRes, poolsRes, policiesRes] = await Promise.all([
        api.get<{ nodes: OrgNode[] }>('/organization/nodes').catch(() => ({ nodes: [] })),
        api.get<{ pools: OverheadPool[] }>('/cost/pools').catch(() => ({ pools: [] })),
        api.get<{ policies: AllocationPolicy[] }>('/cost/policies').catch(() => ({ policies: [] })),
      ]);

      const nList = nodesRes.nodes || [];
      setOrgNodes(nList);
      if (nList[0]) {
        setPoolOrgNodeId(nList[0].id);
        setPolicyOrgNodeId(nList[0].id);
      }

      setPools(poolsRes.pools || []);
      setPolicies(policiesRes.policies || []);
      if (poolsRes.pools?.[0]) setPolicyPoolId(poolsRes.pools[0].id);
      if (policiesRes.policies?.[0]) setExecPolicyId(policiesRes.policies[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  async function handleCreatePool(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/cost/pools', {
        code: poolCode,
        name: poolName,
        poolType,
        periodStart,
        periodEnd,
        currencyCode: 'EGP',
        orgNodeId: poolOrgNodeId,
      });
      setSuccess('تم إنشاء مجمع المصروفات بنجاح');
      setShowPoolForm(false);
      setPoolCode('');
      setPoolName('');
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إنشاء المجمع');
    }
  }

  async function handleAddEntry(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!selectedPoolId) return;
    setError(null);
    try {
      await api.post(`/cost/pools/${selectedPoolId}/entries`, {
        description: entryDesc,
        amount: entryAmount,
        sourceReference: entryRef || undefined,
      });
      setSuccess('تمت إضافة بند المصروف بنجاح');
      setShowEntryForm(false);
      setEntryDesc('');
      setEntryAmount('');
      setEntryRef('');
      await loadAll();
      await openPoolEntries(selectedPoolId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إضافة البند');
    }
  }

  async function handleActivatePool(poolId: string): Promise<void> {
    setError(null);
    try {
      await api.post(`/cost/pools/${poolId}/activate`, {});
      setSuccess('تم تفعيل المجمع بنجاح وهو الآن جاهز لتطبيق السياسات');
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تفعيل المجمع');
    }
  }

  async function openPoolEntries(poolId: string): Promise<void> {
    setSelectedPoolId(poolId);
    try {
      const res = await api.get<{ entries: OverheadPoolEntry[] }>(`/cost/pools/${poolId}/entries`).catch(() => ({ entries: [] }));
      setPoolEntries(res.entries || []);
    } catch {
      setPoolEntries([]);
    }
  }

  async function handleCreatePolicy(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/cost/policies', {
        code: policyCode,
        name: policyName,
        poolId: policyPoolId,
        allocationBase: policyBase,
        percentage: policyPercentage,
        orgNodeId: policyOrgNodeId,
      });
      setSuccess('تم حفظ سياسة التوزيع بنجاح');
      setShowPolicyForm(false);
      setPolicyCode('');
      setPolicyName('');
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إنشاء السياسة');
    }
  }

  async function handleExecuteAllocation(): Promise<void> {
    if (!execPolicyId) return;
    setExecuting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post<{ result: AllocationExecutionSummary }>('/cost/allocate', { policyId: execPolicyId });
      setLastSummary(res.result);
      setSuccess('تم تشغيل محرك التوزيع بنجاح وتوزيع التكاليف على أوامر التشغيل!');
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تشغيل التوزيع');
    } finally {
      setExecuting(false);
    }
  }

  async function handleLoadPolicyResults(policyId: string): Promise<void> {
    setExecPolicyId(policyId);
    try {
      const res = await api.get<{ results: AllocationResult[] }>(`/cost/allocations/${policyId}/results`);
      const pol = policies.find((p) => p.id === policyId);
      const pool = pools.find((p) => p.id === pol?.poolId);
      if (res.results && res.results.length > 0) {
        const totalBase = res.results.reduce((s, r) => s + Number(r.baseQuantity), 0);
        const totalAlloc = res.results.reduce((s, r) => s + Number(r.allocatedAmount), 0);
        setLastSummary({
          policyId,
          policyName: pol?.name || '',
          poolName: pool?.name || '',
          allocationBase: pol?.allocationBase || '',
          totalPoolAmount: pool?.totalAmount || '0',
          percentageApplied: pol?.percentage || '100',
          amountToAllocate: totalAlloc.toFixed(4),
          totalBaseQuantity: totalBase.toFixed(4),
          baseRate: res.results[0]?.baseRate || '0',
          workOrdersAffected: res.results.length,
          results: res.results,
        });
      } else {
        setLastSummary(null);
      }
    } catch {
      setLastSummary(null);
    }
  }

  const baseLabels: Record<string, string> = {
    units_produced: 'حجم الإنتاج (عدد الوحدات)',
    machine_hours: 'ساعات تشغيل الماكينات',
    direct_labor_hours: 'ساعات العمالة المباشرة',
    direct_labor_cost: 'تكلفة العمالة المباشرة',
    direct_material_cost: 'تكلفة المواد المباشرة',
    sales_revenue: 'قيمة المبيعات والإيرادات',
  };

  const poolTypeLabels: Record<string, string> = {
    manufacturing_overhead: 'أعباء صناعية غير مباشرة (MOH)',
    administrative: 'مصروفات إدارية وعمومية (G&A)',
    selling_marketing: 'مصروفات بيع وتسويق (S&M)',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: '#111827' }}>
            {isRtl ? 'سياسات وتوزيع المصروفات العامة والتكاليف غير المباشرة' : 'Overhead Allocation Engine'}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '14px' }}>
            {isRtl
              ? 'تجميع المصروفات الصناعية والإدارية وتوزيعها بدقة على أوامر التشغيل والمنتج النهائي'
              : 'Pool indirect expenses & distribute them accurately across work orders & finished goods'}
          </p>
        </div>
        <button
          onClick={() => void loadAll()}
          style={{ padding: '8px 16px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
        >
          {isRtl ? '🔄 تحديث' : '🔄 Refresh'}
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#FEE2E2', border: '1px solid #F87171', borderRadius: '8px', color: '#991B1B', marginBottom: '16px' }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', background: '#D1FAE5', border: '1px solid #34D399', borderRadius: '8px', color: '#065F46', marginBottom: '16px' }}>
          ✓ {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E5E7EB', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('pools')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pools' ? '3px solid #2563EB' : '3px solid transparent',
            color: activeTab === 'pools' ? '#2563EB' : '#4B5563',
            fontWeight: activeTab === 'pools' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '15px',
          }}
        >
          📦 {isRtl ? '1. مجمعات المصروفات (Expense Pools)' : '1. Overhead Pools'}
        </button>
        <button
          onClick={() => setActiveTab('policies')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'policies' ? '3px solid #2563EB' : '3px solid transparent',
            color: activeTab === 'policies' ? '#2563EB' : '#4B5563',
            fontWeight: activeTab === 'policies' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '15px',
          }}
        >
          ⚖️ {isRtl ? '2. سياسات التوزيع (Allocation Policies)' : '2. Allocation Policies'}
        </button>
        <button
          onClick={() => setActiveTab('run')}
          style={{
            padding: '10px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'run' ? '3px solid #10B981' : '3px solid transparent',
            color: activeTab === 'run' ? '#10B981' : '#4B5563',
            fontWeight: activeTab === 'run' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '15px',
          }}
        >
          🚀 {isRtl ? '3. تشغيل المحرك والنتائج (Allocation Run & Results)' : '3. Run & Results'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>جاري تحميل البيانات...</div>
      ) : (
        <>
          {/* ═══════════════════════════════════════════════ */}
          {/* TAB 1: OVERHEAD POOLS */}
          {/* ═══════════════════════════════════════════════ */}
          {activeTab === 'pools' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{isRtl ? 'قائمة مجمعات التكاليف غير المباشرة' : 'Overhead Expense Pools'}</h2>
                <button
                  onClick={() => setShowPoolForm(!showPoolForm)}
                  style={{ padding: '8px 16px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {showPoolForm ? (isRtl ? 'إلغاء' : 'Cancel') : isRtl ? '+ إنشاء مجمع مصروفات جديد' : '+ New Pool'}
                </button>
              </div>

              {/* Pool Creation Form */}
              {showPoolForm && (
                <form onSubmit={handleCreatePool} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>{isRtl ? 'بيانات مجمع المصروفات الجديد' : 'New Overhead Pool'}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'كود المجمع' : 'Pool Code'}</label>
                      <input
                        type="text"
                        required
                        placeholder="OH-2026-09"
                        value={poolCode}
                        onChange={(e) => setPoolCode(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'اسم المجمع / الوصف' : 'Pool Name'}</label>
                      <input
                        type="text"
                        required
                        placeholder="مصروفات تشغيل المصنع لشهر سبتمبر"
                        value={poolName}
                        onChange={(e) => setPoolName(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'نوع المصروفات' : 'Pool Type'}</label>
                      <select
                        value={poolType}
                        onChange={(e) => setPoolType(e.target.value as any)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      >
                        <option value="manufacturing_overhead">أعباء صناعية غير مباشرة (MOH)</option>
                        <option value="administrative">مصروفات إدارية وعمومية (G&A)</option>
                        <option value="selling_marketing">مصروفات بيع وتسويق (S&M)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'بداية الفترة' : 'Period Start'}</label>
                      <input
                        type="text"
                        required
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'نهاية الفترة' : 'Period End'}</label>
                      <input
                        type="text"
                        required
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'الشركة / الفرع' : 'Org Node'}</label>
                      <select
                        value={poolOrgNodeId}
                        onChange={(e) => setPoolOrgNodeId(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      >
                        {orgNodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit" style={{ padding: '8px 20px', background: '#059669', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                    {isRtl ? '✓ حفظ المجمع' : 'Save Pool'}
                  </button>
                </form>
              )}

              {/* Pools Table */}
              <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isRtl ? 'right' : 'left' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: '13px', color: '#4B5563' }}>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'الكود' : 'Code'}</th>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'اسم المجمع' : 'Name'}</th>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'النوع' : 'Type'}</th>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'الفترة' : 'Period'}</th>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'إجمالي المصروفات' : 'Total Amount'}</th>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'الحالة' : 'Status'}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>{isRtl ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pools.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>
                          {isRtl ? 'لا توجد مجمعات مصروفات مسجلة' : 'No overhead pools found'}
                        </td>
                      </tr>
                    ) : (
                      pools.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #E5E7EB', fontSize: '14px' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1F2937' }}>{p.code}</td>
                          <td style={{ padding: '12px 16px' }}>{p.name}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '12px', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 500 }}>
                              {poolTypeLabels[p.poolType] || p.poolType}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563' }}>
                            {p.periodStart.slice(0, 10)} ➔ {p.periodEnd.slice(0, 10)}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#059669' }}>
                            {Number(p.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {p.currencyCode}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                fontSize: '12px',
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontWeight: 600,
                                background: p.status === 'active' ? '#D1FAE5' : p.status === 'allocated' ? '#FEF3C7' : '#F3F4F6',
                                color: p.status === 'active' ? '#065F46' : p.status === 'allocated' ? '#92400E' : '#374151',
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                onClick={() => void openPoolEntries(p.id)}
                                style={{ padding: '4px 10px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                📝 {isRtl ? 'البنود' : 'Entries'}
                              </button>
                              {p.status === 'draft' && (
                                <button
                                  onClick={() => void handleActivatePool(p.id)}
                                  style={{ padding: '4px 10px', background: '#059669', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                >
                                  ⚡ {isRtl ? 'تفعيل' : 'Activate'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pool Entries Drawer / Section */}
              {selectedPoolId && (
                <div style={{ background: '#FFF', border: '2px solid #3B82F6', borderRadius: '8px', padding: '20px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1E40AF' }}>
                      📋 {isRtl ? 'بنود المصروفات للمجمع المحدد' : 'Pool Expense Entries'}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setShowEntryForm(!showEntryForm)}
                        style={{ padding: '6px 14px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                      >
                        {showEntryForm ? (isRtl ? 'إلغاء' : 'Cancel') : isRtl ? '+ إضافة بند مصروف' : '+ Add Entry'}
                      </button>
                      <button
                        onClick={() => setSelectedPoolId(null)}
                        style={{ padding: '6px 12px', background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                      >
                        ✕ {isRtl ? 'إغلاق' : 'Close'}
                      </button>
                    </div>
                  </div>

                  {showEntryForm && (
                    <form onSubmit={handleAddEntry} style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'بيان المصروف' : 'Description'}</label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: فاتورة كهرباء المصنع"
                            value={entryDesc}
                            onChange={(e) => setEntryDesc(e.target.value)}
                            style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'المبلغ (ج.م)' : 'Amount'}</label>
                          <input
                            type="number"
                            required
                            placeholder="15000"
                            value={entryAmount}
                            onChange={(e) => setEntryAmount(e.target.value)}
                            style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'رقم المستند / المرجع' : 'Source Ref'}</label>
                          <input
                            type="text"
                            placeholder="INV-9921"
                            value={entryRef}
                            onChange={(e) => setEntryRef(e.target.value)}
                            style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                          />
                        </div>
                        <button type="submit" style={{ padding: '8px 16px', background: '#059669', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, height: '38px' }}>
                          + {isRtl ? 'إضافة' : 'Add'}
                        </button>
                      </div>
                    </form>
                  )}

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isRtl ? 'right' : 'left' }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: '12px', color: '#4B5563' }}>
                        <th style={{ padding: '8px 12px' }}>{isRtl ? 'البيان' : 'Description'}</th>
                        <th style={{ padding: '8px 12px' }}>{isRtl ? 'المبلغ' : 'Amount'}</th>
                        <th style={{ padding: '8px 12px' }}>{isRtl ? 'المرجع' : 'Reference'}</th>
                        <th style={{ padding: '8px 12px' }}>{isRtl ? 'تاريخ التسجيل' : 'Date'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poolEntries.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
                            {isRtl ? 'لا توجد بنود مصروفات مضافة لهذا المجمع حتى الآن' : 'No expense entries in this pool'}
                          </td>
                        </tr>
                      ) : (
                        poolEntries.map((e) => (
                          <tr key={e.id} style={{ borderBottom: '1px solid #F3F4F6', fontSize: '13px' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>{e.description}</td>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#059669' }}>
                              {Number(e.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                            </td>
                            <td style={{ padding: '8px 12px', color: '#6B7280' }}>{e.sourceReference || '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#6B7280' }}>{e.recordedAt.slice(0, 10)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════ */}
          {/* TAB 2: ALLOCATION POLICIES */}
          {/* ═══════════════════════════════════════════════ */}
          {activeTab === 'policies' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{isRtl ? 'قواعد وسياسات التوزيع المعيارية' : 'Overhead Allocation Policies'}</h2>
                <button
                  onClick={() => setShowPolicyForm(!showPolicyForm)}
                  style={{ padding: '8px 16px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                  {showPolicyForm ? (isRtl ? 'إلغاء' : 'Cancel') : isRtl ? '+ إنشاء سياسة توزيع جديدة' : '+ New Policy'}
                </button>
              </div>

              {/* Policy Creation Form */}
              {showPolicyForm && (
                <form onSubmit={handleCreatePolicy} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600 }}>{isRtl ? 'إعداد سياسة توزيع جديدة' : 'New Allocation Policy'}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'كود السياسة' : 'Policy Code'}</label>
                      <input
                        type="text"
                        required
                        placeholder="POL-UNITS-SEP26"
                        value={policyCode}
                        onChange={(e) => setPolicyCode(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'اسم السياسة' : 'Policy Name'}</label>
                      <input
                        type="text"
                        required
                        placeholder="توزيع مصروفات سبتمبر بحجم الإنتاج"
                        value={policyName}
                        onChange={(e) => setPolicyName(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'مجمع المصروفات المرتبط' : 'Expense Pool'}</label>
                      <select
                        value={policyPoolId}
                        onChange={(e) => setPolicyPoolId(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      >
                        {pools.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name} ({Number(p.totalAmount).toLocaleString()} EGP)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'أساس التوزيع (Allocation Base)' : 'Allocation Base'}</label>
                      <select
                        value={policyBase}
                        onChange={(e) => setPolicyBase(e.target.value as any)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', fontWeight: 600, color: '#1E40AF' }}
                      >
                        <option value="units_produced">حجم الإنتاج (عدد الوحدات المنتجة)</option>
                        <option value="machine_hours">ساعات تشغيل الماكينات (Machine Hours)</option>
                        <option value="direct_labor_hours">ساعات العمالة المباشرة (Labor Hours)</option>
                        <option value="direct_labor_cost">تكلفة العمالة المباشرة (Labor Cost)</option>
                        <option value="direct_material_cost">تكلفة الخامات المباشرة (Material Cost)</option>
                        <option value="sales_revenue">قيمة المبيعات والإيرادات (Sales Revenue)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>{isRtl ? 'النسبة المئوية (%)' : 'Percentage (%)'}</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={policyPercentage}
                        onChange={(e) => setPolicyPercentage(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                      />
                    </div>
                  </div>
                  <button type="submit" style={{ padding: '8px 20px', background: '#059669', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                    {isRtl ? '✓ حفظ السياسة' : 'Save Policy'}
                  </button>
                </form>
              )}

              {/* Policies Table */}
              <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isRtl ? 'right' : 'left' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: '13px', color: '#4B5563' }}>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'كود السياسة' : 'Code'}</th>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'اسم السياسة' : 'Policy Name'}</th>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'أساس التوزيع' : 'Allocation Base'}</th>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'النسبة' : 'Percentage'}</th>
                      <th style={{ padding: '12px 16px' }}>{isRtl ? 'الحالة' : 'Status'}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>{isRtl ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>
                          {isRtl ? 'لا توجد سياسات توزيع مسجلة' : 'No allocation policies found'}
                        </td>
                      </tr>
                    ) : (
                      policies.map((pol) => (
                        <tr key={pol.id} style={{ borderBottom: '1px solid #E5E7EB', fontSize: '14px' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1F2937' }}>{pol.code}</td>
                          <td style={{ padding: '12px 16px' }}>{pol.name}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: '#FEF3C7', color: '#92400E', fontWeight: 600 }}>
                              {baseLabels[pol.allocationBase] || pol.allocationBase}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#2563EB' }}>{Number(pol.percentage).toFixed(0)}%</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '12px', background: '#D1FAE5', color: '#065F46', fontWeight: 600 }}>
                              {pol.isActive === 'yes' ? 'نشط' : 'معطل'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setExecPolicyId(pol.id);
                                setActiveTab('run');
                                void handleLoadPolicyResults(pol.id);
                              }}
                              style={{ padding: '4px 12px', background: '#10B981', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                            >
                              🚀 {isRtl ? 'تشغيل / عرض النتائج' : 'Run / Results'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════ */}
          {/* TAB 3: RUN ALLOCATION & LIVE RESULTS */}
          {/* ═══════════════════════════════════════════════ */}
          {activeTab === 'run' && (
            <div>
              {/* Execution Bar */}
              <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
                      {isRtl ? 'اختر سياسة التوزيع المراد تشغيلها:' : 'Select Allocation Policy to Execute:'}
                    </label>
                    <select
                      value={execPolicyId}
                      onChange={(e) => {
                        setExecPolicyId(e.target.value);
                        void handleLoadPolicyResults(e.target.value);
                      }}
                      style={{ width: '100%', padding: '10px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '14px', fontWeight: 500 }}
                    >
                      {policies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name} ({baseLabels[p.allocationBase]})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleExecuteAllocation}
                    disabled={executing || !execPolicyId}
                    style={{
                      padding: '10px 24px',
                      background: executing ? '#9CA3AF' : '#10B981',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: executing ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      fontSize: '15px',
                      height: '42px',
                    }}
                  >
                    {executing ? (isRtl ? 'جاري التوزيع...' : 'Allocating...') : isRtl ? '🚀 تشغيل محرك التوزيع الآن' : '🚀 Execute Allocation Engine'}
                  </button>
                </div>
              </div>

              {/* Execution Summary Cards */}
              {lastSummary && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontSize: '12px', color: '#1E40AF', fontWeight: 600 }}>{isRtl ? 'إجمالي مجمع المصروفات' : 'Pool Total Amount'}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#1E3A8A', marginTop: '4px' }}>
                        {Number(lastSummary.totalPoolAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </div>
                    </div>
                    <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontSize: '12px', color: '#065F46', fontWeight: 600 }}>{isRtl ? 'المبلغ الموزع فعلياً' : 'Allocated Amount'}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#047857', marginTop: '4px' }}>
                        {Number(lastSummary.amountToAllocate).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                      </div>
                    </div>
                    <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontSize: '12px', color: '#92400E', fontWeight: 600 }}>{isRtl ? 'إجمالي حجم الأساس الفعلي' : 'Total Base Quantity'}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#B45309', marginTop: '4px' }}>
                        {Number(lastSummary.totalBaseQuantity).toLocaleString('en-US')} {baseLabels[lastSummary.allocationBase]}
                      </div>
                    </div>
                    <div style={{ background: '#F3E8FF', border: '1px solid #E9D5FF', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontSize: '12px', color: '#6B21A8', fontWeight: 600 }}>{isRtl ? 'معدل تحميل الوحدة (Base Rate)' : 'Unit Base Rate'}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: '#7E22CE', marginTop: '4px' }}>
                        {Number(lastSummary.baseRate).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP / وحدة
                      </div>
                    </div>
                  </div>

                  {/* Detailed Results Table */}
                  <div style={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                        {isRtl ? `نتائج التوزيع التفصيلية على أوامر التشغيل (${lastSummary.workOrdersAffected} أمر متأثر)` : `Detailed Allocation Results (${lastSummary.workOrdersAffected} orders)`}
                      </h3>
                      <span style={{ fontSize: '12px', color: '#4B5563' }}>
                        {isRtl ? 'السياسة:' : 'Policy:'} <strong>{lastSummary.policyName}</strong>
                      </span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isRtl ? 'right' : 'left' }}>
                      <thead>
                        <tr style={{ background: '#FFF', borderBottom: '1px solid #E5E7EB', fontSize: '13px', color: '#4B5563' }}>
                          <th style={{ padding: '12px 16px' }}>#</th>
                          <th style={{ padding: '12px 16px' }}>{isRtl ? 'معرف أمر التشغيل' : 'Work Order ID'}</th>
                          <th style={{ padding: '12px 16px' }}>{isRtl ? 'حصة الأساس الفعلي' : 'Actual Base Qty'}</th>
                          <th style={{ padding: '12px 16px' }}>{isRtl ? 'معدل التحميل' : 'Base Rate'}</th>
                          <th style={{ padding: '12px 16px' }}>{isRtl ? 'المصروف المحمل (التكلفة الموزعة)' : 'Allocated Overhead Cost'}</th>
                          <th style={{ padding: '12px 16px' }}>{isRtl ? 'تاريخ التوزيع' : 'Allocation Date'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastSummary.results.map((r, idx) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6', fontSize: '13px' }}>
                            <td style={{ padding: '12px 16px', color: '#9CA3AF' }}>{idx + 1}</td>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1F2937' }}>
                              {r.workOrderId ? r.workOrderId.slice(0, 8) + '...' : r.jobOrderReference || '—'}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>{Number(r.baseQuantity).toLocaleString('en-US')}</td>
                            <td style={{ padding: '12px 16px', color: '#4B5563' }}>{Number(r.baseRate).toFixed(4)} EGP</td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#059669', fontSize: '14px' }}>
                              {Number(r.allocatedAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                            </td>
                            <td style={{ padding: '12px 16px', color: '#6B7280', fontSize: '12px' }}>{r.allocatedAt.slice(0, 19).replace('T', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
