import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { asc, count, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { CatalogNotFoundError } from '../catalog/catalog.errors';
import { CatalogService } from '../catalog/catalog.service';
import { InventoryNotFoundError, InventoryValidationError } from './inventory.errors';
import { InventoryRepository } from './inventory.repository';
import { pickList, pickListLine } from './inventory.schema';
import { InventoryService } from './inventory.service';
import { planPicks, type PickPlan } from './pick-list.engine';

export type PickListPurpose = 'delivery' | 'material_transfer';
export type PickListStatus = 'draft' | 'completed' | 'cancelled';
export interface PickListLineRecord {
  id: string;
  itemId: string;
  warehouseId: string;
  batchId: string | null;
  quantity: string;
  pickedQuantity: string | null;
  lineNumber: number;
}
export interface PickListRecord {
  id: string;
  pickListNumber: string;
  purpose: PickListPurpose;
  status: PickListStatus;
  scopeWarehouseId: string | null;
  targetWarehouseId: string | null;
  reference: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PickListLineRecord[];
}
export interface PickRequestInput {
  items: Array<{ itemId: string; quantity: string }>;
  scopeWarehouseId?: string;
}
export interface CreatePickListInput extends PickRequestInput {
  purpose?: PickListPurpose;
  targetWarehouseId?: string;
  reference?: string;
  allowPartial?: boolean;
}

/** Pick list with automatic FIFO / earliest-expiry batch picking (plan item 27). */
@Injectable()
export class PickListService {
  constructor(
    private readonly database: DatabaseService,
    private readonly inventory: InventoryService,
    private readonly repository: InventoryRepository,
    @Optional() private readonly catalog?: CatalogService,
  ) {}

  /** Proposes where to pick from without saving anything. */
  async suggest(input: PickRequestInput): Promise<PickPlan> {
    const requests = input.items.map((i) => ({ itemId: i.itemId, quantity: Number(i.quantity) }));
    if (requests.length === 0) throw new InventoryValidationError('at least one item is required');
    if (requests.some((r) => !(r.quantity > 0)))
      throw new InventoryValidationError('every quantity must be positive');
    const batchItems = new Set<string>();
    for (const itemId of new Set(requests.map((r) => r.itemId))) {
      const item = await this.itemFlags(itemId);
      if (item?.hasSerialNo)
        throw new InventoryValidationError(
          `الصنف ${item.code} متتبّع بالسيريال — الانتقاء التلقائي للسيريال لسه مش مدعوم`,
        );
      if (item?.hasBatchNo) batchItems.add(itemId);
    }
    const scope = await this.scopeWarehouses(input.scopeWarehouseId);
    const bins = (await this.inventory.getBins())
      .filter((b) => scope.has(b.warehouseId))
      .map((b) => ({
        itemId: b.itemId,
        warehouseId: b.warehouseId,
        available: Number(b.availableQty),
      }));
    const batchRows = [];
    for (const itemId of batchItems) {
      const meta = new Map((await this.repository.listBatches(itemId)).map((b) => [b.id, b]));
      for (const bb of await this.repository.listBatchBalances(itemId)) {
        const b = meta.get(bb.batchId);
        if (!b || !scope.has(bb.warehouseId)) continue;
        batchRows.push({
          itemId,
          warehouseId: bb.warehouseId,
          batchId: bb.batchId,
          quantity: Number(bb.quantity),
          expiryDate: b.expiryDate,
          manufacturingDate: b.manufacturingDate,
          createdAt: b.createdAt,
          status: b.status,
        });
      }
    }
    return planPicks(requests, (id) => batchItems.has(id), bins, batchRows);
  }

  async create(input: CreatePickListInput): Promise<PickListRecord> {
    const purpose = input.purpose ?? 'delivery';
    if (purpose === 'material_transfer') {
      if (!input.targetWarehouseId)
        throw new InventoryValidationError(
          'targetWarehouseId is required for a material transfer pick list',
        );
      const target = await this.repository.findWarehouseById(input.targetWarehouseId);
      if (!target)
        throw new InventoryNotFoundError(`warehouse ${input.targetWarehouseId} does not exist`);
      if (target.isGroup)
        throw new InventoryValidationError(
          `warehouse ${target.code} is a group warehouse and cannot hold stock (plan item 23)`,
        );
    }
    const plan = await this.suggest(input);
    if (plan.shortfalls.length > 0 && !input.allowPartial) {
      const parts = await Promise.all(
        plan.shortfalls.map(
          async (s) =>
            `صنف ${(await this.itemFlags(s.itemId))?.code ?? s.itemId} ناقص ${s.missing}`,
        ),
      );
      throw new InventoryValidationError(`الرصيد المتاح مش كفاية: ${parts.join('، ')}`);
    }
    if (plan.lines.length === 0)
      throw new InventoryValidationError('nothing can be picked — no available stock');
    const id = randomUUID();
    const n = Number((await this.database.db.select({ n: count() }).from(pickList))[0]?.n ?? 0) + 1;
    await this.database.db.insert(pickList).values({
      id,
      pickListNumber: `PICK-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`,
      purpose,
      scopeWarehouseId: input.scopeWarehouseId ?? null,
      targetWarehouseId: purpose === 'material_transfer' ? input.targetWarehouseId! : null,
      reference: input.reference?.trim() || null,
    });
    await this.database.db.insert(pickListLine).values(
      plan.lines.map((l, i) => ({
        pickListId: id,
        itemId: l.itemId,
        warehouseId: l.warehouseId,
        batchId: l.batchId,
        quantity: l.quantity.toFixed(6),
        lineNumber: i + 1,
      })),
    );
    return this.get(id);
  }

  async list(): Promise<PickListRecord[]> {
    const rows = await this.database.db
      .select({ id: pickList.id })
      .from(pickList)
      .orderBy(asc(pickList.createdAt));
    return Promise.all(rows.map((r) => this.get(r.id)));
  }

  async get(id: string): Promise<PickListRecord> {
    const r = (
      await this.database.db.select().from(pickList).where(eq(pickList.id, id)).limit(1)
    )[0];
    if (!r) throw new InventoryNotFoundError(`pick list ${id} does not exist`);
    const lines = await this.database.db
      .select()
      .from(pickListLine)
      .where(eq(pickListLine.pickListId, id))
      .orderBy(asc(pickListLine.lineNumber));
    return {
      id: r.id,
      pickListNumber: r.pickListNumber,
      purpose: r.purpose as PickListPurpose,
      status: r.status as PickListStatus,
      scopeWarehouseId: r.scopeWarehouseId,
      targetWarehouseId: r.targetWarehouseId,
      reference: r.reference,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      lines: lines.map((l) => ({
        id: l.id,
        itemId: l.itemId,
        warehouseId: l.warehouseId,
        batchId: l.batchId,
        quantity: l.quantity,
        pickedQuantity: l.pickedQuantity,
        lineNumber: l.lineNumber,
      })),
    };
  }

  /**
   * Records what was actually picked (default: the planned quantity) and moves the stock:
   * a delivery pick list issues it, a material transfer moves it to the target warehouse.
   */
  async complete(
    id: string,
    picked: Array<{ lineId: string; pickedQuantity: string }> = [],
  ): Promise<PickListRecord> {
    const list = await this.get(id);
    if (list.status !== 'draft')
      throw new InventoryValidationError(
        `pick list ${list.pickListNumber} is already "${list.status}"`,
      );
    const pickedBy = new Map(picked.map((p) => [p.lineId, Number(p.pickedQuantity)]));
    for (const lineId of pickedBy.keys()) {
      if (!list.lines.some((l) => l.id === lineId))
        throw new InventoryValidationError(
          `line ${lineId} is not on pick list ${list.pickListNumber}`,
        );
    }
    const plan = list.lines.map((l) => {
      const qty = pickedBy.get(l.id) ?? Number(l.quantity);
      if (!(qty >= 0) || qty > Number(l.quantity))
        throw new InventoryValidationError(
          `picked quantity on line ${l.lineNumber} must be between 0 and ${Number(l.quantity)}`,
        );
      return { line: l, qty };
    });
    for (const { line, qty } of plan) {
      if (qty > 0) {
        const common = {
          itemId: line.itemId,
          quantity: qty.toFixed(6),
          batchId: line.batchId ?? undefined,
          sourceModule: 'pick_list',
          sourceId: list.id,
          note: list.pickListNumber,
        };
        if (list.purpose === 'delivery') {
          await this.inventory.createMovement({
            ...common,
            warehouseId: line.warehouseId,
            movementType: 'issue',
          });
        } else {
          await this.inventory.transferStock({
            ...common,
            fromWarehouseId: line.warehouseId,
            toWarehouseId: list.targetWarehouseId!,
          });
        }
      }
      await this.database.db
        .update(pickListLine)
        .set({ pickedQuantity: qty.toFixed(6) })
        .where(eq(pickListLine.id, line.id));
    }
    await this.database.db
      .update(pickList)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(pickList.id, id));
    return this.get(id);
  }

  async cancel(id: string): Promise<PickListRecord> {
    const list = await this.get(id);
    if (list.status !== 'draft')
      throw new InventoryValidationError(
        `pick list ${list.pickListNumber} is already "${list.status}"`,
      );
    await this.database.db
      .update(pickList)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(pickList.id, id));
    return this.get(id);
  }

  /** Stock-holding warehouses the user may see, limited to a warehouse or a group's subtree (item 23). */
  private async scopeWarehouses(scopeWarehouseId?: string): Promise<Set<string>> {
    const visible = await this.inventory.getWarehouses();
    if (!scopeWarehouseId) return new Set(visible.filter((w) => !w.isGroup).map((w) => w.id));
    if (!visible.some((w) => w.id === scopeWarehouseId))
      throw new InventoryNotFoundError(`warehouse ${scopeWarehouseId} does not exist`);
    const inScope = new Set([scopeWarehouseId]);
    for (let grew = true; grew;) {
      grew = false;
      for (const w of visible) {
        if (w.parentWarehouseId && inScope.has(w.parentWarehouseId) && !inScope.has(w.id)) {
          inScope.add(w.id);
          grew = true;
        }
      }
    }
    return new Set(visible.filter((w) => inScope.has(w.id) && !w.isGroup).map((w) => w.id));
  }

  private async itemFlags(
    itemId: string,
  ): Promise<{ code: string; hasBatchNo: boolean; hasSerialNo: boolean } | null> {
    if (!this.catalog) return null;
    try {
      return await this.catalog.getItem(itemId);
    } catch (err) {
      if (err instanceof CatalogNotFoundError)
        throw new InventoryNotFoundError(`item ${itemId} does not exist`);
      throw err;
    }
  }
}
