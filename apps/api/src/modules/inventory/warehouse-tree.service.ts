import { Injectable } from '@nestjs/common';
import { InventoryNotFoundError, InventoryValidationError } from './inventory.errors';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';
import type { WarehouseRecord } from './inventory.types';

export interface WarehouseTreeNode {
  id: string;
  code: string;
  name: string;
  isGroup: boolean;
  parentWarehouseId: string | null;
  /** Stock held directly in this warehouse (always 0 for a group). */
  ownOnHand: string;
  ownValue: string;
  /** Stock of this warehouse plus every warehouse under it. */
  totalOnHand: string;
  totalValue: string;
  children: WarehouseTreeNode[];
}

/** Builds the warehouse tree with rolled-up totals (pure). */
export function buildWarehouseTree(
  warehouses: Array<
    Pick<WarehouseRecord, 'id' | 'code' | 'name' | 'parentWarehouseId' | 'isGroup'>
  >,
  balances: Array<{ warehouseId: string; onHand: string; totalValue: string | null }>,
): WarehouseTreeNode[] {
  const own = new Map<string, { qty: number; value: number }>();
  for (const b of balances) {
    const cur = own.get(b.warehouseId) ?? { qty: 0, value: 0 };
    cur.qty += Number(b.onHand);
    cur.value += Number(b.totalValue ?? 0);
    own.set(b.warehouseId, cur);
  }
  const ids = new Set(warehouses.map((w) => w.id));
  const byParent = new Map<string | null, typeof warehouses>();
  for (const w of warehouses) {
    // a parent outside the visible set makes the warehouse a root of what the user can see
    const key = w.parentWarehouseId && ids.has(w.parentWarehouseId) ? w.parentWarehouseId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), w]);
  }
  const build = (w: (typeof warehouses)[number]): WarehouseTreeNode => {
    const children = (byParent.get(w.id) ?? []).map(build);
    const o = own.get(w.id) ?? { qty: 0, value: 0 };
    const totalQty = children.reduce((s, c) => s + Number(c.totalOnHand), o.qty);
    const totalVal = children.reduce((s, c) => s + Number(c.totalValue), o.value);
    return {
      id: w.id,
      code: w.code,
      name: w.name,
      isGroup: w.isGroup ?? false,
      parentWarehouseId: w.parentWarehouseId ?? null,
      ownOnHand: o.qty.toFixed(6),
      ownValue: o.value.toFixed(4),
      totalOnHand: totalQty.toFixed(6),
      totalValue: totalVal.toFixed(4),
      children,
    };
  };
  return (byParent.get(null) ?? []).map(build);
}

/** Tree warehouses (plan item 23): group warehouses hold no stock and roll up their children. */
@Injectable()
export class WarehouseTreeService {
  constructor(
    private readonly repository: InventoryRepository,
    private readonly inventory: InventoryService,
  ) {}

  /** Only the warehouses the current user may see (plan item 5.2). */
  async tree(): Promise<WarehouseTreeNode[]> {
    const [warehouses, balances] = await Promise.all([
      this.inventory.getWarehouses(),
      this.inventory.getBalances(),
    ]);
    return buildWarehouseTree(warehouses, balances);
  }

  /** Moves a warehouse under a group warehouse, or to the top level with null. */
  async setParent(id: string, parentWarehouseId: string | null): Promise<WarehouseRecord> {
    const target = await this.mustFind(id);
    if (parentWarehouseId !== null) {
      if (parentWarehouseId === id)
        throw new InventoryValidationError('a warehouse cannot be its own parent');
      const parent = await this.mustFind(parentWarehouseId);
      if (!parent.isGroup)
        throw new InventoryValidationError(
          `المخزن ${parent.code} مش مجموعة — لازم الأب يكون مخزن مجموعة`,
        );
      const all = await this.repository.listWarehouses();
      const parentOf = new Map(all.map((w) => [w.id, w.parentWarehouseId ?? null]));
      for (
        let cur: string | null = parentWarehouseId, guard = 0;
        cur && guard <= all.length;
        cur = parentOf.get(cur) ?? null, guard++
      ) {
        if (cur === id)
          throw new InventoryValidationError(
            `نقل ${target.code} تحت ${parent.code} هيعمل حلقة في الشجرة`,
          );
      }
    }
    await this.repository.setWarehouseTree(id, { parentWarehouseId });
    return this.mustFind(id);
  }

  /** Turns a warehouse into a group (no stock history allowed) or back (no children allowed). */
  async setGroup(id: string, isGroup: boolean): Promise<WarehouseRecord> {
    const target = await this.mustFind(id);
    if (isGroup && !target.isGroup && (await this.repository.warehouseHasStockHistory(id))) {
      throw new InventoryValidationError(
        `مينفعش تحوّل ${target.code} لمجموعة — عليه رصيد أو حركات`,
      );
    }
    if (!isGroup && target.isGroup) {
      const children = (await this.repository.listWarehouses()).filter(
        (w) => w.parentWarehouseId === id,
      );
      if (children.length > 0) {
        throw new InventoryValidationError(
          `مينفعش تلغي المجموعة ${target.code} — تحتها ${children.map((c) => c.code).join('، ')}`,
        );
      }
    }
    await this.repository.setWarehouseTree(id, { isGroup });
    return this.mustFind(id);
  }

  private async mustFind(id: string): Promise<WarehouseRecord> {
    const w = await this.repository.findWarehouseById(id);
    if (!w) throw new InventoryNotFoundError(`warehouse ${id} does not exist`);
    return w;
  }
}
