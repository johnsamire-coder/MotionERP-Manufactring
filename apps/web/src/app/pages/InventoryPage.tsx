import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

interface ItemCategoryTreeNode { id: string; code: string; name: string; children: ItemCategoryTreeNode[]; }
interface ItemRecord { id: string; code: string; name: string; itemType: string; categoryId: string; baseUnitId: string; status: string; }
interface UomRecord { id: string; code: string; name: string; }
interface WarehouseRecord { id: string; code: string; name: string; orgNodeId: string; status: string; }
interface StockBalanceRecord { id: string; itemId: string; warehouseId: string; onHand: string; reserved: string; available: string; }

const ITEM_TYPES = ['raw_material', 'finished_product', 'semi_finished_product', 'consumable', 'spare_part', 'service'];

function flattenCategories(nodes: ItemCategoryTreeNode[], depth = 0): Array<{ id: string; code: string; label: string }> {
  const out: Array<{ id: string; code: string; label: string }> = [];
  for (const node of nodes) {
    out.push({ id: node.id, code: node.code, label: `${'— '.repeat(depth)}${node.name}` });
    out.push(...flattenCategories(node.children, depth + 1));
  }
  return out;
}

/** Generates the next sequential code with a fixed prefix, based on how many existing codes already use it. */
function nextCode(prefix: string, existingCodes: string[]): string {
  const matching = existingCodes.filter((c) => c.toUpperCase().startsWith(prefix.toUpperCase()));
  return `${prefix}-${String(matching.length + 1).padStart(4, '0')}`;
}

export function InventoryPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; code: string; label: string }>>([]);
  const [uoms, setUoms] = useState<UomRecord[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([]);
  const [balances, setBalances] = useState<StockBalanceRecord[]>([]);
  const [orgNodeId, setOrgNodeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [itemCode, setItemCode] = useState('');
  const [itemNameAr, setItemNameAr] = useState('');
  const [itemNameEn, setItemNameEn] = useState('');
  const [itemType, setItemType] = useState('raw_material');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemUomId, setItemUomId] = useState('');

  const [catCode, setCatCode] = useState('');
  const [catNameAr, setCatNameAr] = useState('');
  const [catNameEn, setCatNameEn] = useState('');

  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');

  const [mvItemId, setMvItemId] = useState('');
  const [mvWarehouseId, setMvWarehouseId] = useState('');
  const [mvType, setMvType] = useState('receipt');
  const [mvQty, setMvQty] = useState('');

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
      const [itemsRes, treeRes, uomsRes, warehousesRes, balancesRes, orgRes] = await Promise.all([
        api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
        api.get<{ tree: ItemCategoryTreeNode[] }>(`/catalog/categories/tree?lang=${lang}`),
        api.get<{ uoms: UomRecord[] }>(`/catalog/uoms?lang=${lang}`),
        api.get<{ warehouses: WarehouseRecord[] }>('/inventory/warehouses'),
        api.get<{ balances: StockBalanceRecord[] }>('/inventory/balances'),
        api.get<{ tree: Array<{ id: string }> }>('/organization/tree'),
      ]);
      setItems(itemsRes.items);
      const flat = flattenCategories(treeRes.tree);
      setCategories(flat);
      setUoms(uomsRes.uoms);
      setWarehouses(warehousesRes.warehouses);
      setBalances(balancesRes.balances);
      if (orgRes.tree[0]) setOrgNodeId(orgRes.tree[0].id);
      if (!itemCategoryId && flat[0]) setItemCategoryId(flat[0].id);
      if (!itemUomId && uomsRes.uoms[0]) setItemUomId(uomsRes.uoms[0].id);
      if (!mvItemId && itemsRes.items[0]) setMvItemId(itemsRes.items[0].id);
      if (!mvWarehouseId && warehousesRes.warehouses[0]) setMvWarehouseId(warehousesRes.warehouses[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, [i18n.language]);

  function openItemForm(): void {
    setItemCode(nextCode('ITEM', items.map((i) => i.code)));
    setShowItemForm((v) => !v);
  }
  function openCategoryForm(): void {
    setCatCode(nextCode('CAT', categories.map((c) => c.code)));
    setShowCategoryForm((v) => !v);
  }
  function openWarehouseForm(): void {
    setWhCode(nextCode('WH', warehouses.map((w) => w.code)));
    setShowWarehouseForm((v) => !v);
  }

  async function handleCreateItem(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/catalog/items', {
        code: itemCode, name: itemNameEn || itemNameAr, nameAr: itemNameAr || undefined, nameEn: itemNameEn || undefined,
        itemType, categoryId: itemCategoryId, baseUnitId: itemUomId,
      });
      setItemCode(''); setItemNameAr(''); setItemNameEn(''); setShowItemForm(false); setFormSuccess(t('pages.inventory.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateCategory(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/catalog/categories', {
        code: catCode, name: catNameEn || catNameAr, nameAr: catNameAr || undefined, nameEn: catNameEn || undefined,
      });
      setCatCode(''); setCatNameAr(''); setCatNameEn(''); setShowCategoryForm(false); setFormSuccess(t('pages.inventory.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateWarehouse(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/inventory/warehouses', { code: whCode, name: whName, orgNodeId });
      setWhCode(''); setWhName(''); setShowWarehouseForm(false); setFormSuccess(t('pages.inventory.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  async function handleCreateMovement(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null); setFormSuccess(null); setSubmitting(true);
    try {
      await api.post('/inventory/movements', { itemId: mvItemId, warehouseId: mvWarehouseId, movementType: mvType, quantity: mvQty });
      setMvQty(''); setShowMovementForm(false); setFormSuccess(t('pages.inventory.form.success'));
      await loadAll();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Failed'); } finally { setSubmitting(false); }
  }

  const categoryLabel = (id: string): string => categories.find((c) => c.id === id)?.label ?? '—';
  const itemLabel = (id: string): string => items.find((i) => i.id === id)?.name ?? id;
  const warehouseLabel = (id: string): string => warehouses.find((w) => w.id === id)?.name ?? id;
  const itemTypeLabel = (type: string): string => t(`pages.inventory.itemTypes.${type}`, type);
  const inputStyle = { padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 140 };
  const labelStyle = { fontSize: 12, color: '#64748b' };

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.inventory.eyebrow')}</span>
          <h1>{t('pages.inventory.title')}</h1>
          <p>{t('pages.inventory.description')}</p>
        </div>
      </div>

      {formError && <p style={{ color: '#b91c1c', padding: '8px 0' }}>{formError}</p>}
      {formSuccess && <p style={{ color: '#166534', padding: '8px 0' }}>{formSuccess}</p>}

      {/* Shared datalists for code auto-suggestion (Google-style typeahead) */}
      <datalist id="item-codes-list">{items.map((i) => <option key={i.id} value={i.code} />)}</datalist>
      <datalist id="category-codes-list">{categories.map((c) => <option key={c.id} value={c.code} />)}</datalist>
      <datalist id="warehouse-codes-list">{warehouses.map((w) => <option key={w.id} value={w.code} />)}</datalist>

      {/* ---- Items ---- */}
      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">{t('pages.inventory.table.eyebrow')}</span>
            <h2>{t('pages.inventory.table.title')}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="filter-button" onClick={openCategoryForm}>{t('pages.inventory.form.addCategory')}</button>
            <button className="primary-button" onClick={openItemForm}><b>+</b>{t('pages.inventory.form.addItem')}</button>
          </div>
        </div>

        {showCategoryForm && (
          <form onSubmit={(e) => { void handleCreateCategory(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.categoryCode')}</label>
              <input list="category-codes-list" value={catCode} onChange={(e) => setCatCode(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.nameAr')}</label>
              <input value={catNameAr} onChange={(e) => setCatNameAr(e.target.value)} style={inputStyle} dir="rtl" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.nameEn')}</label>
              <input value={catNameEn} onChange={(e) => setCatNameEn(e.target.value)} style={inputStyle} dir="ltr" />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.inventory.form.save')}</button>
          </form>
        )}

        {showItemForm && (
          <form onSubmit={(e) => { void handleCreateItem(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.code')}</label>
              <input list="item-codes-list" value={itemCode} onChange={(e) => setItemCode(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.nameAr')}</label>
              <input value={itemNameAr} onChange={(e) => setItemNameAr(e.target.value)} style={inputStyle} dir="rtl" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.nameEn')}</label>
              <input value={itemNameEn} onChange={(e) => setItemNameEn(e.target.value)} style={inputStyle} dir="ltr" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.itemType')}</label>
              <select value={itemType} onChange={(e) => setItemType(e.target.value)} style={inputStyle}>
                {ITEM_TYPES.map((tp) => <option key={tp} value={tp}>{itemTypeLabel(tp)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.category')}</label>
              <select value={itemCategoryId} onChange={(e) => setItemCategoryId(e.target.value)} style={inputStyle}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.uom')}</label>
              <select value={itemUomId} onChange={(e) => setItemUomId(e.target.value)} style={inputStyle}>
                {uoms.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.inventory.form.save')}</button>
          </form>
        )}

        {loading && <p style={{ padding: '20px 0' }}>{t('pages.inventory.form.loading')}</p>}
        {error && <p style={{ padding: '20px 0', color: '#b91c1c' }}>{error}</p>}

        {!loading && !error && (
          <div className="placeholder-table">
            <div className="placeholder-table__head">
              <span>{t('pages.inventory.table.columnOne')}</span>
              <span>{t('pages.inventory.table.columnTwo')}</span>
              <span>{t('pages.inventory.table.columnThree')}</span>
              <span>{t('pages.inventory.table.columnFour')}</span>
            </div>
            {items.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.inventory.form.empty')}</p>}
            {items.map((item) => (
              <div className="placeholder-table__row" key={item.id}>
                <span><b>{item.name}</b><small>{item.code}</small></span>
                <span>{categoryLabel(item.categoryId)}</span>
                <span>{itemTypeLabel(item.itemType)}</span>
                <span className={`status status--${item.status === 'active' ? 'success' : 'neutral'}`}><i />{item.status}</span>
              </div>
            ))}
          </div>
        )}
      </article>

      {/* ---- Warehouses & Balances ---- */}
      <article className="panel module-panel" style={{ marginTop: 20 }}>
        <div className="panel__head">
          <div><h2>{t('pages.inventory.form.warehouses')}</h2></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="filter-button" onClick={openWarehouseForm}>{t('pages.inventory.form.addWarehouse')}</button>
            <button className="primary-button" onClick={() => setShowMovementForm((v) => !v)}><b>+</b>{t('pages.inventory.form.recordMovement')}</button>
          </div>
        </div>

        {showWarehouseForm && (
          <form onSubmit={(e) => { void handleCreateWarehouse(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.warehouseCode')}</label>
              <input list="warehouse-codes-list" value={whCode} onChange={(e) => setWhCode(e.target.value)} required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.warehouseName')}</label>
              <input value={whName} onChange={(e) => setWhName(e.target.value)} required style={inputStyle} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.inventory.form.save')}</button>
          </form>
        )}

        {showMovementForm && (
          <form onSubmit={(e) => { void handleCreateMovement(e); }} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', padding: '0 0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.item')}</label>
              <select value={mvItemId} onChange={(e) => setMvItemId(e.target.value)} style={inputStyle}>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.warehouse')}</label>
              <select value={mvWarehouseId} onChange={(e) => setMvWarehouseId(e.target.value)} style={inputStyle}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.movementType')}</label>
              <select value={mvType} onChange={(e) => setMvType(e.target.value)} style={inputStyle}>
                <option value="receipt">{t('pages.inventory.form.receipt')}</option>
                <option value="issue">{t('pages.inventory.form.issue')}</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={labelStyle}>{t('pages.inventory.form.quantity')}</label>
              <input type="number" min="0" step="any" value={mvQty} onChange={(e) => setMvQty(e.target.value)} required style={{ ...inputStyle, minWidth: 100 }} />
            </div>
            <button type="submit" disabled={submitting} className="primary-button" style={{ height: 38 }}>{t('pages.inventory.form.save')}</button>
          </form>
        )}

        {!loading && !error && (
          <div className="placeholder-table">
            <div className="placeholder-table__head">
              <span>{t('pages.inventory.form.item')}</span>
              <span>{t('pages.inventory.form.warehouse')}</span>
              <span>{t('pages.inventory.form.onHand')}</span>
              <span>{t('pages.inventory.form.available')}</span>
            </div>
            {balances.length === 0 && <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>{t('pages.inventory.form.empty')}</p>}
            {balances.map((b) => (
              <div className="placeholder-table__row" key={b.id}>
                <span><b>{itemLabel(b.itemId)}</b></span>
                <span>{warehouseLabel(b.warehouseId)}</span>
                <span>{b.onHand}</span>
                <span><b>{b.available}</b></span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
