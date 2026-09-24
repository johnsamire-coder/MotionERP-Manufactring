import { Injectable, Optional } from '@nestjs/common';
import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { AccountingNotFoundError, AccountingValidationError } from '../accounting/accounting.errors';
import { AccountingService } from '../accounting/accounting.service';
import { PostingEngineService } from '../accounting/posting-engine.service';
import { HrService } from '../hr/hr.service';
import { InventoryService } from '../inventory/inventory.service';
import { asset, assetCategory, assetInsurance, assetMovement, assetValueEvent, depreciationSchedule } from './assets.schema';
import { AssetsNotFoundError, AssetsValidationError } from './assets.service';

type AssetRow = typeof asset.$inferSelect;
const today = (): string => new Date().toISOString().slice(0, 10);
const n2 = (v: number): string => v.toFixed(2);

/** Plan item 49: asset movements (location / custodian), insurance, and composite assets. */
@Injectable()
export class AssetLifecycleService {
  constructor(
    private readonly database: DatabaseService,
    private readonly accounting: AccountingService,
    @Optional() private readonly hr?: HrService,
    @Optional() private readonly inventory?: InventoryService,
    @Optional() private readonly postingEngine?: PostingEngineService,
  ) {}

  // --- movement ---
  async move(assetId: string, input: { purpose: 'transfer' | 'issue' | 'receipt'; toLocation?: string; toCustodianId?: string | null; note?: string }): Promise<AssetRow> {
    const a = await this.mustAsset(assetId);
    if (a.status === 'merged' || a.status === 'scrapped') throw new AssetsValidationError(`الأصل ${a.assetCode} "${a.status}"`);
    let toCustodian = a.custodianEmployeeId;
    if (input.purpose === 'issue') {
      if (!input.toCustodianId) throw new AssetsValidationError('التسليم لموظف محتاج toCustodianId');
      await this.checkEmployee(input.toCustodianId);
      toCustodian = input.toCustodianId;
    } else if (input.purpose === 'receipt') {
      if (!a.custodianEmployeeId) throw new AssetsValidationError(`الأصل ${a.assetCode} مش في عهدة حد`);
      toCustodian = null;
    } else if (input.toCustodianId !== undefined) {
      if (input.toCustodianId) await this.checkEmployee(input.toCustodianId);
      toCustodian = input.toCustodianId;
    }
    const toLocation = input.toLocation?.trim() || a.location;
    if (toLocation === a.location && toCustodian === a.custodianEmployeeId) throw new AssetsValidationError('مفيش تغيير في المكان ولا العهدة');
    await this.database.db.insert(assetMovement).values({
      assetId, purpose: input.purpose, fromLocation: a.location, toLocation, fromCustodianId: a.custodianEmployeeId, toCustodianId: toCustodian, note: input.note?.trim() || null,
    });
    return (await this.database.db.update(asset).set({ location: toLocation, custodianEmployeeId: toCustodian, updatedAt: new Date() }).where(eq(asset.id, assetId)).returning())[0]!;
  }

  async movements(assetId: string): Promise<Array<typeof assetMovement.$inferSelect>> {
    await this.mustAsset(assetId);
    return this.database.db.select().from(assetMovement).where(eq(assetMovement.assetId, assetId)).orderBy(asc(assetMovement.movementDate));
  }

  // --- insurance ---
  async addInsurance(assetId: string, input: { insurer: string; policyNumber: string; insuredValue: string; premium?: string; startDate: string; endDate: string }): Promise<typeof assetInsurance.$inferSelect> {
    await this.mustAsset(assetId);
    if (!(Number(input.insuredValue) > 0)) throw new AssetsValidationError('insuredValue must be positive');
    if (input.endDate <= input.startDate) throw new AssetsValidationError('endDate must be after startDate');
    return (await this.database.db.insert(assetInsurance).values({
      assetId, insurer: input.insurer.trim(), policyNumber: input.policyNumber.trim(), insuredValue: n2(Number(input.insuredValue)),
      premium: input.premium ? n2(Number(input.premium)) : null, startDate: input.startDate, endDate: input.endDate,
    }).returning())[0]!;
  }

  /** Policies ending within `withinDays`, and assets in use with no policy running today. */
  async insuranceAlerts(withinDays = 30, on = today()): Promise<{ expiring: Array<typeof assetInsurance.$inferSelect & { assetCode: string }>; uninsured: string[] }> {
    const db = this.database.db;
    const until = new Date(new Date(`${on}T00:00:00Z`).getTime() + withinDays * 86_400_000).toISOString().slice(0, 10);
    const expiring = await db.select({ p: assetInsurance, code: asset.assetCode }).from(assetInsurance).innerJoin(asset, eq(asset.id, assetInsurance.assetId))
      .where(and(gte(assetInsurance.endDate, on), lte(assetInsurance.endDate, until))).orderBy(asc(assetInsurance.endDate));
    const inUse = await db.select().from(asset).where(eq(asset.status, 'in_use'));
    const uninsured: string[] = [];
    for (const a of inUse) {
      const running = await db.select({ id: assetInsurance.id }).from(assetInsurance)
        .where(and(eq(assetInsurance.assetId, a.id), lte(assetInsurance.startDate, on), gte(assetInsurance.endDate, on))).limit(1);
      if (running.length === 0) uninsured.push(a.assetCode);
    }
    return { expiring: expiring.map((r) => ({ ...r.p, assetCode: r.code })), uninsured };
  }

  // --- composite assets ---
  /**
   * Adds components to a composite asset under construction:
   * - an asset: its book value moves into the composite (Dr CWIP, Dr its accumulated depreciation / Cr its asset account); it becomes "merged";
   * - a stock item: issued from the warehouse; its cost is moved from the stock-issue account into the composite's CWIP.
   */
  async addComponents(compositeId: string, input: { assetIds?: string[]; stockItems?: Array<{ itemId: string; warehouseId: string; quantity: string }> }): Promise<AssetRow> {
    const c = await this.mustAsset(compositeId);
    if (c.isComposite !== 'yes' || c.status !== 'cwip') throw new AssetsValidationError(`الأصل ${c.assetCode} مش أصل مركّب تحت التنفيذ`);
    const cat = await this.category(c.categoryId);
    let added = 0;
    for (const id of new Set(input.assetIds ?? [])) {
      if (id === c.id) throw new AssetsValidationError('مينفعش الأصل يبقى مكوّن لنفسه');
      const part = await this.mustAsset(id);
      if (part.orgNodeId !== c.orgNodeId) throw new AssetsValidationError(`الأصل ${part.assetCode} تبع شركة تانية`);
      if (!['draft', 'in_use', 'fully_depreciated'].includes(part.status)) throw new AssetsValidationError(`الأصل ${part.assetCode} "${part.status}" — مينفعش يتضم`);
      const pc = await this.category(part.categoryId);
      const gross = Number(part.grossValue); const acc = Number(part.accumulatedDepreciation); const book = Math.round((gross - acc) * 100) / 100;
      const lines: Array<[string, number, number]> = [[cat.cwipAccountId!, book, 0], [pc.fixedAssetAccountId, 0, gross]];
      if (acc > 0) lines.push([pc.accumulatedDepreciationAccountId, acc, 0]);
      const je = await this.post(c, `ضم الأصل ${part.assetCode} للأصل المركّب ${c.assetCode}`, lines.filter(([, dr, cr]) => dr > 0 || cr > 0));
      await this.database.db.delete(depreciationSchedule).where(and(eq(depreciationSchedule.assetId, part.id), isNull(depreciationSchedule.postedAt)));
      await this.database.db.update(asset).set({ status: 'merged', parentAssetId: c.id, updatedAt: new Date() }).where(eq(asset.id, part.id));
      await this.database.db.insert(assetValueEvent).values({ assetId: c.id, eventType: 'component_asset', eventDate: today(), amount: n2(book), journalEntryId: je, note: part.assetCode });
      added += book;
    }
    for (const s of input.stockItems ?? []) {
      if (!this.inventory) throw new AssetsValidationError('inventory is not available');
      const mv = await this.inventory.createMovement({ itemId: s.itemId, warehouseId: s.warehouseId, movementType: 'issue', quantity: s.quantity, sourceModule: 'asset', sourceId: c.id, note: `مكوّن للأصل ${c.assetCode}` });
      const value = Number(mv.totalValue ?? 0);
      let je: string | null = null;
      const accounts = this.postingEngine ? await this.postingEngine.resolveStockMovementAccounts(c.orgNodeId, s.warehouseId, 'issue', 'asset') : null;
      if (value > 0 && accounts) je = await this.post(c, `تكلفة مخزون مكوّن للأصل ${c.assetCode}`, [[cat.cwipAccountId!, value, 0], [accounts.contraAccountId, 0, value]]);
      await this.database.db.insert(assetValueEvent).values({ assetId: c.id, eventType: 'component_stock', eventDate: today(), amount: n2(value), journalEntryId: je, note: `${s.quantity} × ${s.itemId}` });
      added += value;
    }
    if (added === 0) throw new AssetsValidationError('مفيش مكوّنات اتضافت');
    return (await this.database.db.update(asset).set({ cwipAmount: n2(Number(c.cwipAmount) + added), updatedAt: new Date() }).where(eq(asset.id, c.id)).returning())[0]!;
  }

  async components(compositeId: string): Promise<{ assets: string[]; events: Array<typeof assetValueEvent.$inferSelect> }> {
    const parts = await this.database.db.select({ code: asset.assetCode }).from(asset).where(eq(asset.parentAssetId, compositeId));
    const events = await this.database.db.select().from(assetValueEvent).where(eq(assetValueEvent.assetId, compositeId));
    return { assets: parts.map((p) => p.code), events: events.filter((e) => e.eventType.startsWith('component_')) };
  }

  private async post(a: AssetRow, description: string, lines: Array<[string, number, number]>): Promise<string> {
    try {
      const e = await this.accounting.createEntry({
        orgNodeId: a.orgNodeId, description: `[Auto] ${description}`, reference: a.assetCode, isAutoGenerated: true, sourceEventType: 'asset_composition',
        idempotencyKey: `asset-composition-${a.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lines: lines.map(([accountId, dr, cr]) => ({ accountId, debitAmount: n2(dr), creditAmount: n2(cr), costCenterId: a.costCenterId ?? undefined })),
      });
      return (await this.accounting.postEntry(e.id)).id;
    } catch (err) {
      if (err instanceof AccountingValidationError || err instanceof AccountingNotFoundError) throw new AssetsValidationError(err.message);
      throw err;
    }
  }

  private async checkEmployee(id: string): Promise<void> {
    if (!this.hr) return;
    const e = await this.hr.getEmployee(id).catch(() => null);
    if (!e) throw new AssetsNotFoundError(`employee ${id} does not exist`);
    if (e.status !== 'active') throw new AssetsValidationError(`الموظف ${e.code} مش نشط`);
  }

  private async category(id: string): Promise<typeof assetCategory.$inferSelect> {
    const c = (await this.database.db.select().from(assetCategory).where(eq(assetCategory.id, id)).limit(1))[0];
    if (!c) throw new AssetsNotFoundError(`asset category ${id} does not exist`);
    return c;
  }

  private async mustAsset(id: string): Promise<AssetRow> {
    const a = (await this.database.db.select().from(asset).where(eq(asset.id, id)).limit(1))[0];
    if (!a) throw new AssetsNotFoundError(`asset ${id} does not exist`);
    return a;
  }
}
