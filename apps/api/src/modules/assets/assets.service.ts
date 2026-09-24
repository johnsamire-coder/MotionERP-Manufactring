import { Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { AccountingNotFoundError, AccountingValidationError } from '../accounting/accounting.errors';
import { AccountingService } from '../accounting/accounting.service';
import { asset, assetCategory, assetValueEvent, depreciationSchedule } from './assets.schema';
import { buildSchedule, type DepreciationMethod } from './depreciation.engine';

export class AssetsNotFoundError extends Error { constructor(m: string) { super(m); this.name = 'AssetsNotFoundError'; } }
export class AssetsValidationError extends Error { constructor(m: string) { super(m); this.name = 'AssetsValidationError'; } }

type AssetRow = typeof asset.$inferSelect;
type CategoryRow = typeof assetCategory.$inferSelect;
const today = (): string => new Date().toISOString().slice(0, 10);
const n2 = (v: number): string => v.toFixed(2);

/** Fixed assets with CWIP, four depreciation methods and an auto-recalculated schedule (plan item 46). */
@Injectable()
export class AssetsService {
  constructor(private readonly database: DatabaseService, private readonly accounting: AccountingService) {}

  async createCategory(input: {
    orgNodeId: string; code: string; name: string; fixedAssetAccountId: string; accumulatedDepreciationAccountId: string;
    depreciationExpenseAccountId: string; cwipAccountId?: string; defaultMethod?: DepreciationMethod; defaultPeriods?: number; defaultFrequencyMonths?: number;
  }): Promise<CategoryRow> {
    const accounts = [input.fixedAssetAccountId, input.accumulatedDepreciationAccountId, input.depreciationExpenseAccountId, input.cwipAccountId].filter((a): a is string => Boolean(a));
    if (new Set(accounts).size !== accounts.length) throw new AssetsValidationError('the category accounts must be different accounts');
    const known = new Map((await this.accounting.getAccounts()).map((a) => [a.id, a]));
    for (const id of accounts) {
      const a = known.get(id);
      if (!a) throw new AssetsNotFoundError(`account ${id} does not exist`);
      if (a.orgNodeId !== input.orgNodeId) throw new AssetsValidationError(`الحساب ${a.code} تبع شركة تانية`);
      if (!a.isLeaf) throw new AssetsValidationError(`الحساب ${a.code} حساب أب`);
    }
    return (await this.database.db.insert(assetCategory).values({
      orgNodeId: input.orgNodeId, code: input.code.trim(), name: input.name.trim(), fixedAssetAccountId: input.fixedAssetAccountId,
      accumulatedDepreciationAccountId: input.accumulatedDepreciationAccountId, depreciationExpenseAccountId: input.depreciationExpenseAccountId,
      cwipAccountId: input.cwipAccountId ?? null, defaultMethod: input.defaultMethod ?? 'straight_line', defaultPeriods: input.defaultPeriods ?? 60,
      defaultFrequencyMonths: input.defaultFrequencyMonths ?? 1,
    }).returning())[0]!;
  }

  async listCategories(orgNodeId?: string): Promise<CategoryRow[]> {
    const q = this.database.db.select().from(assetCategory);
    return orgNodeId ? q.where(eq(assetCategory.orgNodeId, orgNodeId)) : q;
  }

  async create(input: {
    assetCode: string; name: string; categoryId: string; isCwip?: boolean; grossValue?: string; salvageValue?: string; openingAccumulated?: string;
    method?: DepreciationMethod; periods?: number; frequencyMonths?: number; annualRatePercent?: string; manualAmounts?: number[]; costCenterId?: string;
  }): Promise<AssetRow> {
    const cat = await this.category(input.categoryId);
    if (input.isCwip && !cat.cwipAccountId) throw new AssetsValidationError(`الفئة ${cat.code} ملهاش حساب أصول تحت التنفيذ`);
    const gross = Number(input.grossValue ?? 0);
    if (!input.isCwip && !(gross > 0)) throw new AssetsValidationError('grossValue must be positive for an asset that is not under construction');
    const frequency = input.frequencyMonths ?? cat.defaultFrequencyMonths;
    if (![1, 3, 6, 12].includes(frequency)) throw new AssetsValidationError('frequencyMonths must be 1, 3, 6 or 12');
    return (await this.database.db.insert(asset).values({
      assetCode: input.assetCode.trim(), name: input.name.trim(), orgNodeId: cat.orgNodeId, categoryId: cat.id,
      status: input.isCwip ? 'cwip' : 'draft', isCwip: input.isCwip ? 'yes' : 'no', grossValue: n2(input.isCwip ? 0 : gross),
      salvageValue: n2(Number(input.salvageValue ?? 0)), openingAccumulated: n2(Number(input.openingAccumulated ?? 0)),
      accumulatedDepreciation: n2(Number(input.openingAccumulated ?? 0)), method: input.method ?? (cat.defaultMethod as DepreciationMethod),
      periods: input.periods ?? cat.defaultPeriods, frequencyMonths: frequency, annualRatePercent: input.annualRatePercent ?? null,
      manualAmounts: input.manualAmounts ?? null, costCenterId: input.costCenterId ?? null,
    }).returning())[0]!;
  }

  /** CWIP: books a cost onto the asset under construction (Dr CWIP / Cr the given account). */
  async addCwipCost(id: string, input: { amount: string; contraAccountId: string; date?: string; note?: string }): Promise<AssetRow> {
    const a = await this.mustAsset(id);
    if (a.status !== 'cwip') throw new AssetsValidationError(`الأصل ${a.assetCode} مش تحت التنفيذ`);
    const amount = Number(input.amount);
    if (!(amount > 0)) throw new AssetsValidationError('amount must be positive');
    const cat = await this.category(a.categoryId);
    const je = await this.post(a, input.date ?? today(), `تكلفة أصل تحت التنفيذ ${a.assetCode}${input.note ? ` — ${input.note}` : ''}`, 'asset_cwip',
      [[cat.cwipAccountId!, amount, 0], [input.contraAccountId, 0, amount]]);
    await this.database.db.insert(assetValueEvent).values({ assetId: a.id, eventType: 'cwip_cost', eventDate: input.date ?? today(), amount: n2(amount), journalEntryId: je, note: input.note ?? null });
    return this.set(a.id, { cwipAmount: n2(Number(a.cwipAmount) + amount) });
  }

  /** CWIP → in use: Dr fixed asset / Cr CWIP for everything capitalised, then the schedule is built. */
  async capitalise(id: string, input: { availableForUseDate: string }): Promise<AssetRow & { schedule: Array<typeof depreciationSchedule.$inferSelect> }> {
    const a = await this.mustAsset(id);
    if (a.status !== 'cwip') throw new AssetsValidationError(`الأصل ${a.assetCode} مش تحت التنفيذ`);
    const amount = Number(a.cwipAmount);
    if (!(amount > 0)) throw new AssetsValidationError(`مفيش تكاليف متسجلة على الأصل ${a.assetCode} تحت التنفيذ`);
    const cat = await this.category(a.categoryId);
    const je = await this.post(a, input.availableForUseDate, `رسملة الأصل ${a.assetCode}`, 'asset_capitalisation', [[cat.fixedAssetAccountId, amount, 0], [cat.cwipAccountId!, 0, amount]]);
    await this.database.db.insert(assetValueEvent).values({ assetId: a.id, eventType: 'capitalisation', eventDate: input.availableForUseDate, amount: n2(amount), journalEntryId: je });
    await this.set(a.id, { grossValue: n2(amount) });
    return this.putInUse(a.id, input.availableForUseDate);
  }

  /** A bought asset (cost already booked by its purchase) goes into use and gets its schedule. */
  async submit(id: string, input: { availableForUseDate: string }): Promise<AssetRow & { schedule: Array<typeof depreciationSchedule.$inferSelect> }> {
    const a = await this.mustAsset(id);
    if (a.status !== 'draft') throw new AssetsValidationError(`الأصل ${a.assetCode} "${a.status}"`);
    return this.putInUse(a.id, input.availableForUseDate);
  }

  /**
   * Value adjustment (impairment / revaluation): Dr/Cr the fixed asset account against the given account,
   * then the unposted schedule is rebuilt from the new book value over the remaining periods.
   */
  async adjustValue(id: string, input: { newBookValue: string; differenceAccountId: string; date?: string; note?: string }): Promise<AssetRow & { schedule: Array<typeof depreciationSchedule.$inferSelect> }> {
    const a = await this.mustAsset(id);
    if (a.status !== 'in_use') throw new AssetsValidationError(`الأصل ${a.assetCode} مش في الاستخدام`);
    const book = Number(a.grossValue) - Number(a.accumulatedDepreciation);
    const target = Number(input.newBookValue);
    if (!(target >= Number(a.salvageValue))) throw new AssetsValidationError(`القيمة الجديدة لازم تكون ≥ قيمة الخردة ${a.salvageValue}`);
    const diff = Math.round((target - book) * 100) / 100;
    if (diff === 0) throw new AssetsValidationError('القيمة الجديدة هي نفس القيمة الدفترية');
    const cat = await this.category(a.categoryId);
    const date = input.date ?? today();
    const je = await this.post(a, date, `تعديل قيمة الأصل ${a.assetCode}${input.note ? ` — ${input.note}` : ''}`, 'asset_value_adjustment',
      diff > 0 ? [[cat.fixedAssetAccountId, diff, 0], [input.differenceAccountId, 0, diff]] : [[input.differenceAccountId, -diff, 0], [cat.fixedAssetAccountId, 0, -diff]]);
    await this.database.db.insert(assetValueEvent).values({ assetId: a.id, eventType: 'value_adjustment', eventDate: date, amount: n2(diff), journalEntryId: je, note: input.note ?? null });
    await this.set(a.id, { grossValue: n2(Number(a.grossValue) + diff) });
    await this.rebuildSchedule(a.id);
    return this.get(a.id);
  }

  /** Posts every schedule row due on or before `asOf` (Dr depreciation expense / Cr accumulated depreciation). */
  async depreciateDue(asOf = today()): Promise<Array<{ assetCode: string; rowNumber: number; amount: string }>> {
    const db = this.database.db;
    const due = await db.select().from(depreciationSchedule)
      .where(and(isNull(depreciationSchedule.postedAt), lte(depreciationSchedule.scheduleDate, asOf))).orderBy(asc(depreciationSchedule.scheduleDate), asc(depreciationSchedule.rowNumber));
    const done = [];
    for (const row of due) {
      const a = await this.mustAsset(row.assetId);
      if (a.status !== 'in_use') continue;
      const cat = await this.category(a.categoryId);
      const amount = Number(row.amount);
      const je = amount > 0
        ? await this.post(a, row.scheduleDate, `قسط إهلاك ${row.rowNumber} للأصل ${a.assetCode}`, 'asset_depreciation', [[cat.depreciationExpenseAccountId, amount, 0], [cat.accumulatedDepreciationAccountId, 0, amount]], `asset-dep-${row.id}`)
        : null;
      await db.update(depreciationSchedule).set({ journalEntryId: je, postedAt: new Date() }).where(eq(depreciationSchedule.id, row.id));
      const accumulated = Number(a.accumulatedDepreciation) + amount;
      const left = await db.select({ id: depreciationSchedule.id }).from(depreciationSchedule).where(and(eq(depreciationSchedule.assetId, a.id), isNull(depreciationSchedule.postedAt)));
      await this.set(a.id, { accumulatedDepreciation: n2(accumulated), ...(left.length === 0 ? { status: 'fully_depreciated' } : {}) });
      done.push({ assetCode: a.assetCode, rowNumber: row.rowNumber, amount: n2(amount) });
    }
    return done;
  }

  async list(orgNodeId?: string): Promise<AssetRow[]> {
    const q = this.database.db.select().from(asset);
    return orgNodeId ? q.where(eq(asset.orgNodeId, orgNodeId)).orderBy(asc(asset.assetCode)) : q.orderBy(asc(asset.assetCode));
  }

  async get(id: string): Promise<AssetRow & { schedule: Array<typeof depreciationSchedule.$inferSelect>; bookValue: string; events: Array<typeof assetValueEvent.$inferSelect> }> {
    const a = await this.mustAsset(id);
    const schedule = await this.database.db.select().from(depreciationSchedule).where(eq(depreciationSchedule.assetId, id)).orderBy(asc(depreciationSchedule.rowNumber));
    const events = await this.database.db.select().from(assetValueEvent).where(eq(assetValueEvent.assetId, id)).orderBy(asc(assetValueEvent.createdAt));
    return { ...a, schedule, events, bookValue: n2(Number(a.grossValue) - Number(a.accumulatedDepreciation)) };
  }

  // --- helpers ---
  private async putInUse(id: string, availableForUseDate: string): Promise<AssetRow & { schedule: Array<typeof depreciationSchedule.$inferSelect> }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(availableForUseDate)) throw new AssetsValidationError('availableForUseDate must look like 2026-01-31');
    await this.set(id, { status: 'in_use', availableForUseDate });
    await this.rebuildSchedule(id);
    return this.get(id);
  }

  /** Keeps posted rows; replaces the rest with a fresh schedule from the current book value over the remaining periods. */
  private async rebuildSchedule(id: string): Promise<void> {
    const db = this.database.db;
    const a = await this.mustAsset(id);
    const rows = await db.select().from(depreciationSchedule).where(eq(depreciationSchedule.assetId, id)).orderBy(asc(depreciationSchedule.rowNumber));
    const posted = rows.filter((r) => r.postedAt !== null);
    await db.delete(depreciationSchedule).where(and(eq(depreciationSchedule.assetId, id), isNull(depreciationSchedule.postedAt)));
    const remaining = a.periods - posted.length;
    if (remaining <= 0) return;
    const accumulated = Number(a.accumulatedDepreciation);
    const startValue = Number(a.grossValue) - accumulated;
    const lastPosted = posted.at(-1)?.scheduleDate;
    const [y, m] = (lastPosted ?? a.availableForUseDate!).split('-').map(Number);
    // first row: month-end one period after the last posted row, or the month-end of the in-use month's period
    const first = new Date(Date.UTC(y!, m! - 1 + (lastPosted ? a.frequencyMonths : a.frequencyMonths - 1) + 1, 0)).toISOString().slice(0, 10);
    let schedule;
    try {
      schedule = buildSchedule({
        method: a.method as DepreciationMethod, startValue, salvage: Number(a.salvageValue), periods: remaining, frequencyMonths: a.frequencyMonths,
        firstDate: first, openingAccumulated: accumulated, annualRatePercent: a.annualRatePercent === null ? undefined : Number(a.annualRatePercent),
        manualAmounts: a.method === 'manual' ? (a.manualAmounts ?? []).slice(posted.length) : undefined, firstRowNumber: posted.length + 1,
      });
    } catch (err) {
      throw new AssetsValidationError((err as Error).message);
    }
    if (schedule.length > 0) {
      await db.insert(depreciationSchedule).values(schedule.map((s) => ({ assetId: id, rowNumber: s.rowNumber, scheduleDate: s.date, amount: n2(s.amount), accumulated: n2(s.accumulated) })));
    }
  }

  private async post(a: AssetRow, date: string, description: string, source: string, lines: Array<[string, number, number]>, idempotencyKey?: string): Promise<string> {
    try {
      const e = await this.accounting.createEntry({
        orgNodeId: a.orgNodeId, description: `[Auto] ${description}`, reference: a.assetCode, entryDate: `${date}T12:00:00Z`, isAutoGenerated: true,
        sourceEventType: source, idempotencyKey: idempotencyKey ?? `${source}-${a.id}-${Date.now()}`,
        lines: lines.map(([accountId, dr, cr]) => ({ accountId, debitAmount: n2(dr), creditAmount: n2(cr), costCenterId: a.costCenterId ?? undefined })),
      });
      return (await this.accounting.postEntry(e.id)).id;
    } catch (err) {
      if (err instanceof AccountingValidationError || err instanceof AccountingNotFoundError) throw new AssetsValidationError(err.message);
      throw err;
    }
  }

  private async set(id: string, fields: Partial<AssetRow>): Promise<AssetRow> {
    return (await this.database.db.update(asset).set({ ...fields, updatedAt: new Date() }).where(eq(asset.id, id)).returning())[0]!;
  }

  private async category(id: string): Promise<CategoryRow> {
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
