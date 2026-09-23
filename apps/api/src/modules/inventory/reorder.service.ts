import { Injectable, Optional } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { CatalogNotFoundError } from '../catalog/catalog.errors';
import { CatalogService } from '../catalog/catalog.service';
import { InventoryNotFoundError, InventoryValidationError } from './inventory.errors';
import { InventoryRepository } from './inventory.repository';
import { itemReorder } from './inventory.schema';
import { InventoryService } from './inventory.service';

export type ReorderRequestType = 'purchase' | 'transfer' | 'manufacture';
export interface ItemReorderRecord {
  id: string; itemId: string; warehouseId: string; reorderLevel: string; reorderQty: string; requestType: ReorderRequestType;
}
export interface ReorderSuggestion extends ItemReorderRecord { projectedQty: string; suggestedQty: string; }

/** Suggested quantity for one rule (pure): max(reorder_qty, level − projected) when projected ≤ level. */
export function reorderSuggestion(projected: number, level: number, qty: number): number | null {
  if (projected > level) return null;
  return Math.max(qty, level - projected);
}

/** Reorder level per item / warehouse (plan item 22). */
@Injectable()
export class ReorderService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventory: InventoryService,
    private readonly repository: InventoryRepository,
    @Optional() private readonly catalog?: CatalogService,
  ) {}

  async list(): Promise<ItemReorderRecord[]> {
    return (await this.database.db.select().from(itemReorder).orderBy(asc(itemReorder.createdAt))).map(toRecord);
  }

  async upsert(input: { itemId: string; warehouseId: string; reorderLevel: string; reorderQty: string; requestType?: ReorderRequestType }): Promise<ItemReorderRecord> {
    const level = Number(input.reorderLevel);
    const qty = Number(input.reorderQty);
    if (!(level >= 0) || !(qty > 0)) throw new InventoryValidationError('reorderLevel must be ≥ 0 and reorderQty > 0');
    if (!(await this.repository.findWarehouseById(input.warehouseId))) throw new InventoryNotFoundError(`warehouse ${input.warehouseId} does not exist`);
    if (this.catalog) {
      await this.catalog.getItem(input.itemId).catch((err) => {
        if (err instanceof CatalogNotFoundError) throw new InventoryNotFoundError(`item ${input.itemId} does not exist`);
        throw err;
      });
    }
    const values = { reorderLevel: level.toFixed(6), reorderQty: qty.toFixed(6), requestType: input.requestType ?? 'purchase', updatedAt: new Date() };
    const rows = await this.database.db.insert(itemReorder).values({ itemId: input.itemId, warehouseId: input.warehouseId, ...values })
      .onConflictDoUpdate({ target: [itemReorder.itemId, itemReorder.warehouseId], set: values }).returning();
    return toRecord(rows[0]!);
  }

  async remove(id: string): Promise<void> {
    await this.database.db.delete(itemReorder).where(eq(itemReorder.id, id));
  }

  /** Rules whose projected quantity is at or below the reorder level, with the quantity to request. */
  async suggestions(): Promise<ReorderSuggestion[]> {
    const bins = await this.inventory.getBins();
    const projected = new Map(bins.map((b) => [`${b.itemId}|${b.warehouseId}`, Number(b.projectedQty)]));
    const out: ReorderSuggestion[] = [];
    for (const rule of await this.list()) {
      const p = projected.get(`${rule.itemId}|${rule.warehouseId}`) ?? 0;
      const qty = reorderSuggestion(p, Number(rule.reorderLevel), Number(rule.reorderQty));
      if (qty !== null) out.push({ ...rule, projectedQty: p.toFixed(6), suggestedQty: qty.toFixed(6) });
    }
    return out;
  }

  /**
   * Records every current suggestion as an expected (indented) quantity — a 'material_request'
   * reservation from item 13 — so the projected quantity rises and it is not suggested again.
   * (The material request document itself lives in planning/production, which is not touched.)
   */
  async raise(): Promise<Array<{ itemId: string; warehouseId: string; quantity: string; reservationId: string }>> {
    const raised = [];
    for (const s of await this.suggestions()) {
      const r = await this.inventory.reserveStock({
        itemId: s.itemId, warehouseId: s.warehouseId, quantity: s.suggestedQty,
        source: `reorder:${s.requestType}:${s.id}`, reservationType: 'material_request',
      });
      raised.push({ itemId: s.itemId, warehouseId: s.warehouseId, quantity: s.suggestedQty, reservationId: r.id });
    }
    return raised;
  }
}

function toRecord(r: typeof itemReorder.$inferSelect): ItemReorderRecord {
  return {
    id: r.id, itemId: r.itemId, warehouseId: r.warehouseId, reorderLevel: r.reorderLevel, reorderQty: r.reorderQty,
    requestType: r.requestType as ReorderRequestType,
  };
}
