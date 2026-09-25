import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

type InventoryTab = 'items' | 'balances' | 'batches' | 'serials';

interface ItemCategoryTreeNode {
  id: string;
  code: string;
  name: string;
  children: ItemCategoryTreeNode[];
}
interface ItemRecord {
  id: string;
  code: string;
  name: string;
  itemType: string;
  categoryId: string;
  baseUnitId: string;
  status: string;
}
interface UomRecord {
  id: string;
  code: string;
  name: string;
}
interface WarehouseRecord {
  id: string;
  code: string;
  name: string;
  orgNodeId: string;
  status: string;
}
interface StockBalanceRecord {
  id: string;
  itemId: string;
  warehouseId: string;
  onHand: string;
  reserved: string;
  available: string;
  averageCost?: string;
  totalValue?: string;
}

interface ItemBatchRecord {
  id: string;
  batchNumber: string;
  itemId: string;
  orgNodeId: string;
  manufacturingDate: string | null;
  expiryDate: string | null;
  status: 'active' | 'expired' | 'quarantined' | 'recalled';
  notes: string | null;
  createdAt: string;
}

interface SerialNumberRecord {
  id: string;
  serialNo: string;
  itemId: string;
  warehouseId: string | null;
  batchId: string | null;
  orgNodeId: string;
  status: 'active' | 'delivered' | 'under_maintenance' | 'decommissioned';
  notes: string | null;
  createdAt: string;
}

const ITEM_TYPES = [
  'raw_material',
  'finished_product',
  'semi_finished_product',
  'consumable',
  'spare_part',
  'service',
];

function flattenCategories(
  nodes: ItemCategoryTreeNode[],
  depth = 0,
): Array<{ id: string; code: string; label: string }> {
  const out: Array<{ id: string; code: string; label: string }> = [];
  for (const node of nodes) {
    out.push({ id: node.id, code: node.code, label: `${'— '.repeat(depth)}${node.name}` });
    out.push(...flattenCategories(node.children, depth + 1));
  }
  return out;
}

function nextCode(prefix: string, existingCodes: string[]): string {
  const matching = existingCodes.filter((c) => c.toUpperCase().startsWith(prefix.toUpperCase()));
  return `${prefix}-${String(matching.length + 1).padStart(4, '0')}`;
}

export function InventoryPage(): JSX.Element {
  const { t: _t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<InventoryTab>('items');
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Core Data
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; code: string; label: string }>>(
    [],
  );
  const [uoms, setUoms] = useState<UomRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [balances, setBalances] = useState<StockBalanceRecord[]>([]);
  const [batches, setBatches] = useState<ItemBatchRecord[]>([]);
  const [serials, setSerials] = useState<SerialNumberRecord[]>([]);
  const [orgNodeId, _setOrgNodeId] = useState('00000000-0000-0000-0000-000000000001');

  // Item & Category Forms
  const [showItemForm, setShowItemForm] = useState(false);
  const [_showCategoryForm, _setShowCategoryForm] = useState(false);
  const [itemCode, setItemCode] = useState('');
  const [itemNameAr, setItemNameAr] = useState('');
  const [itemNameEn, setItemNameEn] = useState('');
  const [itemType, setItemType] = useState('raw_material');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemUomId, setItemUomId] = useState('');
  const [_catCode, _setCatCode] = useState('');
  const [_catNameAr, _setCatNameAr] = useState('');
  const [_catNameEn, _setCatNameEn] = useState('');

  // Warehouse & Movement Forms
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');

  // Batch Form
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [batchNo, setBatchNo] = useState('');
  const [batchItemId, setBatchItemId] = useState('');
  const [batchMfgDate, setBatchMfgDate] = useState('');
  const [batchExpDate, setBatchExpDate] = useState('');
  const [batchNotes, setBatchNotes] = useState('');

  // Serial Form & Bulk Modal
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [serialItemId, setSerialItemId] = useState('');
  const [serialPrefix, setSerialPrefix] = useState('SN-CAB');
  const [serialCount, setSerialCount] = useState('5');
  const [serialWhId, setSerialWhId] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, treeRes, uomsRes, warehousesRes, balancesRes, batchesRes, serialsRes] =
        await Promise.all([
          api
            .get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`)
            .catch(() => ({ items: [] })),
          api
            .get<{ tree: ItemCategoryTreeNode[] }>(`/catalog/categories/tree?lang=${lang}`)
            .catch(() => ({ tree: [] })),
          api.get<{ uoms: UomRecord[] }>(`/catalog/uoms?lang=${lang}`).catch(() => ({ uoms: [] })),
          api
            .get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses')
            .catch(() => ({ warehouses: [] })),
          api
            .get<{ balances: StockBalanceRecord[] }>('/inventory/balances')
            .catch(() => ({ balances: [] })),
          api
            .get<{ batches: ItemBatchRecord[] }>('/inventory/batches')
            .catch(() => ({ batches: [] })),
          api
            .get<{ serials: SerialNumberRecord[] }>('/inventory/serials')
            .catch(() => ({ serials: [] })),
        ]);

      const itms = itemsRes.items ?? [];
      setItems(itms);
      const flat = flattenCategories(treeRes.tree ?? []);
      setCategories(flat);
      setUoms(uomsRes.uoms ?? []);
      const whs = warehousesRes.warehouses ?? [];
      setWarehouses(whs);
      setBalances(balancesRes.balances ?? []);
      setBatches(batchesRes.batches ?? []);
      setSerials(serialsRes.serials ?? []);

      if (itms[0]) {
        if (!itemCategoryId && flat[0]) setItemCategoryId(flat[0].id);
        if (!itemUomId && uomsRes.uoms?.[0]) setItemUomId(uomsRes.uoms[0].id);
        if (!batchItemId) setBatchItemId(itms[0].id);
        if (!serialItemId) setSerialItemId(itms[0].id);
      }
      if (whs[0] && !serialWhId) setSerialWhId(whs[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحميل بيانات المخازن');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [i18n.language]);

  // Actions
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/catalog/items', {
        code: itemCode,
        name: itemNameEn || itemNameAr,
        nameAr: itemNameAr || undefined,
        nameEn: itemNameEn || undefined,
        itemType,
        categoryId: itemCategoryId,
        baseUnitId: itemUomId,
      });
      setShowItemForm(false);
      setSuccess('تم إضافة الصنف بنجاح');
      void loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إنشاء الصنف');
    }
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/warehouses', { code: whCode, name: whName, orgNodeId });
      setShowWarehouseForm(false);
      setSuccess('تم إضافة المخزن بنجاح');
      void loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل إنشاء المخزن');
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/batches', {
        batchNumber: batchNo,
        itemId: batchItemId,
        orgNodeId,
        manufacturingDate: batchMfgDate ? new Date(batchMfgDate).toISOString() : undefined,
        expiryDate: batchExpDate ? new Date(batchExpDate).toISOString() : undefined,
        notes: batchNotes.trim() || undefined,
      });
      setShowBatchForm(false);
      setSuccess('تم تسجيل اللوط الطبي بنجاح');
      setBatchNo('');
      void loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تسجيل اللوط الطبي');
    }
  };

  const handleUpdateBatchStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/inventory/batches/${id}/status`, { status });
      setSuccess(
        `تم تحديث حالة اللوط بنجاح إلى: ${status === 'quarantined' ? 'حجر صحي ⚠️' : status === 'recalled' ? 'مستدعى طبياً ❌' : 'نشط ومتاح'}`,
      );
      void loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل تحديث حالة اللوط');
    }
  };

  const handleGenerateBulkSerials = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const count = Math.max(1, parseInt(serialCount, 10));
      const generatedList: string[] = [];
      const timestamp = Date.now().toString().slice(-4);
      for (let i = 1; i <= count; i++) {
        generatedList.push(`${serialPrefix}-${timestamp}-${String(i).padStart(3, '0')}`);
      }

      await api.post('/inventory/serials/bulk', {
        itemId: serialItemId,
        orgNodeId,
        serialNumbers: generatedList,
        warehouseId: serialWhId || undefined,
      });

      setShowSerialModal(false);
      setSuccess(`تم توليد وتسجيل ${count} أرقام تسلسلية فريدة بنجاح!`);
      void loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'فشل توليد السيريالات');
    }
  };

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const whNameLookup = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id;

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">إدارة المخازن والتتبع الطبي</span>
          <h1>المخازن، اللوطات الطبية، والأرقام التسلسلية</h1>
          <p>
            إدارة الأصناف والمستودعات وتتبع أرقام التشغيلات (Batches) وتواريخ الصلاحية والسيريال
            نمبر للأجهزة
          </p>
        </div>
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

      {/* Tabs */}
      <div
        className="tab-nav"
        style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}
      >
        <button
          className={`btn ${activeTab === 'items' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setActiveTab('items')}
        >
          📦 دليل الأصناف ({items.length})
        </button>
        <button
          className={`btn ${activeTab === 'balances' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setActiveTab('balances')}
        >
          🏬 المخازن والأرصدة ({balances.length})
        </button>
        <button
          className={`btn ${activeTab === 'batches' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setActiveTab('batches')}
        >
          🩺 التشغيلات واللوطات الطبية ({batches.length})
        </button>
        <button
          className={`btn ${activeTab === 'serials' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setActiveTab('serials')}
        >
          🔢 السيريال نمبر للأجهزة ({serials.length})
        </button>
      </div>

      {/* Tab 1: Items */}
      {activeTab === 'items' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">كتالوج المنتجات والخامات</span>
              <h2>الأصناف والمستلزمات الطبية (Catalog Items)</h2>
            </div>
            <button
              className="btn btn--primary"
              onClick={() => {
                setItemCode(
                  nextCode(
                    'ITEM',
                    items.map((i) => i.code),
                  ),
                );
                setShowItemForm(!showItemForm);
              }}
            >
              + إضافة صنف جديد
            </button>
          </div>

          {showItemForm && (
            <form className="form-card" onSubmit={handleCreateItem} style={{ marginBottom: 20 }}>
              <h3>إضافة صنف طبي / خام جديد</h3>
              <div className="form-grid">
                <label>
                  كود الصنف
                  <input value={itemCode} onChange={(e) => setItemCode(e.target.value)} required />
                </label>
                <label>
                  الاسم بالعربي
                  <input
                    value={itemNameAr}
                    onChange={(e) => setItemNameAr(e.target.value)}
                    required
                    placeholder="مثال: وحدة درج وضلفة 60"
                  />
                </label>
                <label>
                  الاسم بالإنجليزي
                  <input
                    value={itemNameEn}
                    onChange={(e) => setItemNameEn(e.target.value)}
                    placeholder="Cabinet Drawer Unit 60"
                  />
                </label>
                <label>
                  نوع الصنف
                  <select value={itemType} onChange={(e) => setItemType(e.target.value)}>
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  المجموعة التصنيفية
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  وحدة القياس الأساسية
                  <select value={itemUomId} onChange={(e) => setItemUomId(e.target.value)}>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary">
                  حفظ الصنف
                </button>
                <button type="button" className="btn" onClick={() => setShowItemForm(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          )}

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>كود الصنف</th>
                  <th>اسم الصنف</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4}>لا توجد أصناف مسجلة</td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <b>{it.code}</b>
                      </td>
                      <td>{it.name}</td>
                      <td>
                        <code>{it.itemType}</code>
                      </td>
                      <td>
                        <span className="status-badge status-badge--active">نشط</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Tab 2: Balances */}
      {activeTab === 'balances' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">أرصدة المستودعات</span>
              <h2>المخازن والأرصدة الفعلية والمتاحة (Stock Balances)</h2>
            </div>
            <button
              className="btn btn--primary"
              onClick={() => {
                setWhCode(
                  nextCode(
                    'WH',
                    warehouses.map((w) => w.code),
                  ),
                );
                setShowWarehouseForm(!showWarehouseForm);
              }}
            >
              + إضافة مخزن
            </button>
          </div>

          {showWarehouseForm && (
            <form
              className="form-card"
              onSubmit={handleCreateWarehouse}
              style={{ marginBottom: 20 }}
            >
              <h3>إضافة مخزن جديد</h3>
              <div className="form-grid">
                <label>
                  كود المخزن
                  <input value={whCode} onChange={(e) => setWhCode(e.target.value)} required />
                </label>
                <label>
                  اسم المخزن
                  <input
                    value={whName}
                    onChange={(e) => setWhName(e.target.value)}
                    placeholder="مثال: مخزن المواد الخام الرئيسي"
                    required
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary">
                  حفظ المخزن
                </button>
                <button type="button" className="btn" onClick={() => setShowWarehouseForm(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          )}

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>المخزن</th>
                  <th>الرصيد الفعلي بالمخزن (On Hand)</th>
                  <th>المحجوز لأوامر الشغل (Reserved)</th>
                  <th>المتاح للصرف (Available)</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={5}>لا توجد أرصدة مسجلة في المخازن</td>
                  </tr>
                ) : (
                  balances.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <b>{itemName(b.itemId)}</b>
                      </td>
                      <td>{whNameLookup(b.warehouseId)}</td>
                      <td>{Number(b.onHand).toLocaleString('ar-EG')}</td>
                      <td style={{ color: '#b45309' }}>
                        {Number(b.reserved).toLocaleString('ar-EG')}
                      </td>
                      <td>
                        <b style={{ color: '#166534' }}>
                          {Number(b.available).toLocaleString('ar-EG')}
                        </b>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}

      {/* Tab 3: Medical Batches */}
      {activeTab === 'batches' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">التتبع الطبي والصلاحيات</span>
              <h2>أرقام التشغيلات واللوطات الطبية (Medical Lots / Batches)</h2>
            </div>
            <button className="btn btn--primary" onClick={() => setShowBatchForm(!showBatchForm)}>
              + تسجيل لوط طبي جديد
            </button>
          </div>

          {showBatchForm && (
            <form className="form-card" onSubmit={handleCreateBatch} style={{ marginBottom: 20 }}>
              <h3>تسجيل لوط / تشغيلة طبية جديدة</h3>
              <div className="form-grid">
                <label>
                  الصنف
                  <select
                    value={batchItemId}
                    onChange={(e) => setBatchItemId(e.target.value)}
                    required
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  رقم التشغيلة / اللوط (Batch No)
                  <input
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    placeholder="مثال: LOT-2026-STEEL-01"
                    required
                  />
                </label>
                <label>
                  تاريخ الإنتاج
                  <input
                    type="date"
                    value={batchMfgDate}
                    onChange={(e) => setBatchMfgDate(e.target.value)}
                  />
                </label>
                <label>
                  تاريخ انتهاء الصلاحية
                  <input
                    type="date"
                    value={batchExpDate}
                    onChange={(e) => setBatchExpDate(e.target.value)}
                  />
                </label>
                <label>
                  ملاحظات اللوط
                  <input
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    placeholder="شهادة المطابقة المعقمة"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn--primary">
                  حفظ اللوط
                </button>
                <button type="button" className="btn" onClick={() => setShowBatchForm(false)}>
                  إلغاء
                </button>
              </div>
            </form>
          )}

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم التشغيلة (Batch)</th>
                  <th>الصنف</th>
                  <th>تاريخ الإنتاج</th>
                  <th>تاريخ انتهاء الصلاحية</th>
                  <th>الحالة الرقابية</th>
                  <th>إجراءات الرقابة الطبية</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={6}>لا توجد لوطات طبية مسجلة</td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <b>{b.batchNumber}</b>
                      </td>
                      <td>{itemName(b.itemId)}</td>
                      <td>
                        {b.manufacturingDate
                          ? new Date(b.manufacturingDate).toLocaleDateString('ar-EG')
                          : '—'}
                      </td>
                      <td>
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('ar-EG') : '—'}
                      </td>
                      <td>
                        <span
                          className={`status-badge status-badge--${b.status === 'active' ? 'active' : b.status === 'quarantined' ? 'draft' : 'cancelled'}`}
                        >
                          {b.status === 'active'
                            ? 'نشط ومتاح ✅'
                            : b.status === 'quarantined'
                              ? 'في الحجر الصحي ⚠️'
                              : 'مستدعى طبياً ❌'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {b.status === 'active' && (
                            <button
                              className="btn btn--sm btn--warning"
                              onClick={() => handleUpdateBatchStatus(b.id, 'quarantined')}
                            >
                              حجر صحي ⚠️
                            </button>
                          )}
                          {b.status === 'quarantined' && (
                            <button
                              className="btn btn--sm btn--success"
                              onClick={() => handleUpdateBatchStatus(b.id, 'active')}
                            >
                              إفراج طبي ✅
                            </button>
                          )}
                          {b.status !== 'recalled' && (
                            <button
                              className="btn btn--sm btn--danger"
                              onClick={() => handleUpdateBatchStatus(b.id, 'recalled')}
                            >
                              استدعاء طبي ❌
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
        </article>
      )}

      {/* Tab 4: Serial Numbers */}
      {activeTab === 'serials' && (
        <article className="panel module-panel">
          <div className="panel__head">
            <div>
              <span className="panel__eyebrow">سيريال الأجهزة الطبية</span>
              <h2>الأرقام التسلسلية للأجهزة المصنعة (Serial Numbers)</h2>
            </div>
            <button className="btn btn--primary" onClick={() => setShowSerialModal(true)}>
              ⚡ توليد أرقام تسلسلية بالجملة (Bulk Serials)
            </button>
          </div>

          {showSerialModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
              }}
            >
              <div style={{ background: '#fff', padding: 24, borderRadius: 8, width: 450 }}>
                <h3>توليد أرقام تسلسلية للأجهزة الطبية دفعة واحدة</h3>
                <form
                  onSubmit={handleGenerateBulkSerials}
                  style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}
                >
                  <label>
                    الصنف
                    <select
                      value={serialItemId}
                      onChange={(e) => setSerialItemId(e.target.value)}
                      required
                    >
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    بادئة السيريال (Serial Prefix)
                    <input
                      value={serialPrefix}
                      onChange={(e) => setSerialPrefix(e.target.value)}
                      required
                      placeholder="مثال: SN-CAB"
                    />
                  </label>
                  <label>
                    عدد الأجهزة المصنعة
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={serialCount}
                      onChange={(e) => setSerialCount(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    المخزن
                    <select value={serialWhId} onChange={(e) => setSerialWhId(e.target.value)}>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div
                    style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}
                  >
                    <button type="button" className="btn" onClick={() => setShowSerialModal(false)}>
                      إلغاء
                    </button>
                    <button type="submit" className="btn btn--primary">
                      توليد الأرقام الآن
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>السيريال نمبر (Serial No)</th>
                  <th>الجهاز / الصنف</th>
                  <th>الموقع الحالي</th>
                  <th>الحالة</th>
                  <th>تاريخ التسجيل</th>
                </tr>
              </thead>
              <tbody>
                {serials.length === 0 ? (
                  <tr>
                    <td colSpan={5}>لا توجد أرقام تسلسلية مسجلة</td>
                  </tr>
                ) : (
                  serials.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <b>
                          <code>{s.serialNo}</code>
                        </b>
                      </td>
                      <td>{itemName(s.itemId)}</td>
                      <td>
                        {s.warehouseId ? whNameLookup(s.warehouseId) : 'مُسلم لعميل / مستشفى'}
                      </td>
                      <td>
                        <span
                          className={`status-badge status-badge--${s.status === 'active' ? 'active' : s.status === 'delivered' ? 'active' : 'draft'}`}
                        >
                          {s.status === 'active'
                            ? 'بالمخزن (جاهز)'
                            : s.status === 'delivered'
                              ? 'مُسلَم للعميل'
                              : s.status}
                        </span>
                      </td>
                      <td>{new Date(s.createdAt).toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </section>
  );
}
