/** Pure pick-planning engine for pick lists (plan item 27). */

export interface PickBin { itemId: string; warehouseId: string; available: number; }
export interface PickBatchRow {
  itemId: string; warehouseId: string; batchId: string; quantity: number;
  expiryDate: string | null; manufacturingDate: string | null; createdAt: string; status: string;
}
export interface PlannedPick { itemId: string; warehouseId: string; batchId: string | null; quantity: number; }
export interface PickShortfall { itemId: string; requested: number; picked: number; missing: number; }
export interface PickPlan { lines: PlannedPick[]; shortfalls: PickShortfall[]; }

const time = (d: string | null): number => (d ? new Date(d).getTime() : Number.POSITIVE_INFINITY);
const round = (n: number): number => Number(n.toFixed(6));

/**
 * Batch items: active, unexpired batches ordered by earliest expiry, then oldest manufacture date,
 * then oldest batch (FIFO), never taking more than the warehouse has free (on hand − reserved).
 * Other items: the warehouse with the most free stock first, to keep the picks few.
 */
export function planPicks(
  requests: Array<{ itemId: string; quantity: number }>,
  batchTracked: (itemId: string) => boolean,
  bins: PickBin[],
  batches: PickBatchRow[],
  today: Date = new Date(),
): PickPlan {
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const free = new Map(bins.map((b) => [`${b.itemId}|${b.warehouseId}`, Math.max(0, b.available)]));
  const wanted = new Map<string, number>();
  for (const r of requests) wanted.set(r.itemId, (wanted.get(r.itemId) ?? 0) + r.quantity);

  const lines: PlannedPick[] = [];
  const shortfalls: PickShortfall[] = [];
  for (const [itemId, requested] of wanted) {
    let remaining = requested;
    const take = (warehouseId: string, batchId: string | null, cap: number): void => {
      const key = `${itemId}|${warehouseId}`;
      const qty = round(Math.min(remaining, cap, free.get(key) ?? 0));
      if (qty <= 0) return;
      lines.push({ itemId, warehouseId, batchId, quantity: qty });
      free.set(key, round((free.get(key) ?? 0) - qty));
      remaining = round(remaining - qty);
    };
    if (batchTracked(itemId)) {
      const usable = batches
        .filter((b) => b.itemId === itemId && b.quantity > 0 && b.status === 'active' && time(b.expiryDate) >= startOfDay.getTime())
        .sort((a, b) => time(a.expiryDate) - time(b.expiryDate)
          || time(a.manufacturingDate) - time(b.manufacturingDate)
          || time(a.createdAt) - time(b.createdAt)
          || a.batchId.localeCompare(b.batchId));
      for (const b of usable) { if (remaining <= 0) break; take(b.warehouseId, b.batchId, b.quantity); }
    } else {
      const byStock = bins.filter((b) => b.itemId === itemId).sort((a, b) => b.available - a.available || a.warehouseId.localeCompare(b.warehouseId));
      for (const b of byStock) { if (remaining <= 0) break; take(b.warehouseId, null, Number.POSITIVE_INFINITY); }
    }
    if (remaining > 0) shortfalls.push({ itemId, requested, picked: round(requested - remaining), missing: remaining });
  }
  return { lines, shortfalls };
}
