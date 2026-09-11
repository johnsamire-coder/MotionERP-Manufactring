import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client';

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
  status: string;
}

function flattenCategoryNames(nodes: ItemCategoryTreeNode[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(list: ItemCategoryTreeNode[]): void {
    for (const node of list) {
      map.set(node.id, node.name);
      walk(node.children);
    }
  }
  walk(nodes);
  return map;
}

export function InventoryPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [categoryNames, setCategoryNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
        const [itemsRes, treeRes] = await Promise.all([
          api.get<{ items: ItemRecord[] }>(`/catalog/items?lang=${lang}`),
          api.get<{ tree: ItemCategoryTreeNode[] }>(`/catalog/categories/tree?lang=${lang}`),
        ]);
        if (cancelled) return;
        setItems(itemsRes.items);
        setCategoryNames(flattenCategoryNames(treeRes.tree));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load inventory data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [i18n.language]);

  return (
    <section className="module-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">{t('pages.inventory.eyebrow')}</span>
          <h1>{t('pages.inventory.title')}</h1>
          <p>{t('pages.inventory.description')}</p>
        </div>
      </div>

      <article className="panel module-panel">
        <div className="panel__head">
          <div>
            <span className="panel__eyebrow">{t('pages.inventory.table.eyebrow')}</span>
            <h2>{t('pages.inventory.table.title')}</h2>
          </div>
        </div>

        {loading && <p style={{ padding: '20px 0' }}>Loading…</p>}
        {error && <p style={{ padding: '20px 0', color: '#b91c1c' }}>{error}</p>}

        {!loading && !error && (
          <div className="placeholder-table">
            <div className="placeholder-table__head">
              <span>{t('pages.inventory.table.columnOne')}</span>
              <span>{t('pages.inventory.table.columnTwo')}</span>
              <span>{t('pages.inventory.table.columnThree')}</span>
              <span>{t('pages.inventory.table.columnFour')}</span>
            </div>
            {items.length === 0 && (
              <p style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>No items yet</p>
            )}
            {items.map((item) => (
              <div className="placeholder-table__row" key={item.id}>
                <span><i className="skeleton skeleton--strong" style={{ display: 'none' }} />
                  <b>{item.name}</b><small>{item.code}</small>
                </span>
                <span>{categoryNames.get(item.categoryId) ?? '—'}</span>
                <span>{item.itemType}</span>
                <span className={`status status--${item.status === 'active' ? 'success' : 'neutral'}`}>
                  <i />{item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
