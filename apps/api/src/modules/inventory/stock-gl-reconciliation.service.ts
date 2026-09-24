import { Injectable, Optional } from '@nestjs/common';
import { AccountingNotFoundError, AccountingValidationError } from '../accounting/accounting.errors';
import { AccountingService } from '../accounting/accounting.service';
import type { JournalEntryRecord } from '../accounting/accounting.types';
import { PostingEngineService } from '../accounting/posting-engine.service';
import { InventoryValidationError } from './inventory.errors';
import { InventoryRepository } from './inventory.repository';

export interface AccountComparison {
  inventoryAccountId: string; accountCode: string | null; adjustmentAccountId: string;
  glBalance: string; stockValue: string; difference: string; warehouses: Array<{ id: string; code: string; stockValue: string }>;
}
export interface StockGlComparison {
  orgNodeId: string; asOf: string; accounts: AccountComparison[];
  unmappedWarehouses: Array<{ id: string; code: string; stockValue: string }>;
  totalDifference: string; balanced: boolean;
  /** The correction entry that would bring the ledger to the stock value (empty when balanced). */
  suggestedLines: Array<{ accountId: string; debitAmount: string; creditAmount: string }>;
}

const TOLERANCE = 0.01;

/** Groups stock value by inventory account and compares it with the ledger (pure). */
export function compareStockWithGl(
  warehouses: Array<{ id: string; code: string; stockValue: number; accounts: { inventoryAccountId: string; contraAccountId: string } | null }>,
  glBalance: (accountId: string) => number,
  accountCode: (accountId: string) => string | null,
): Omit<StockGlComparison, 'orgNodeId' | 'asOf'> {
  const groups = new Map<string, { adjustment: string; value: number; warehouses: Array<{ id: string; code: string; stockValue: string }> }>();
  const unmapped: Array<{ id: string; code: string; stockValue: string }> = [];
  for (const w of warehouses) {
    if (!w.accounts) {
      if (Math.abs(w.stockValue) > TOLERANCE) unmapped.push({ id: w.id, code: w.code, stockValue: w.stockValue.toFixed(4) });
      continue;
    }
    const g = groups.get(w.accounts.inventoryAccountId) ?? { adjustment: w.accounts.contraAccountId, value: 0, warehouses: [] };
    g.value += w.stockValue;
    g.warehouses.push({ id: w.id, code: w.code, stockValue: w.stockValue.toFixed(4) });
    groups.set(w.accounts.inventoryAccountId, g);
  }
  const accounts: AccountComparison[] = [];
  const suggestedLines: StockGlComparison['suggestedLines'] = [];
  let total = 0;
  for (const [accountId, g] of groups) {
    const gl = glBalance(accountId);
    const diff = Number((g.value - gl).toFixed(4));
    total += diff;
    accounts.push({
      inventoryAccountId: accountId, accountCode: accountCode(accountId), adjustmentAccountId: g.adjustment,
      glBalance: gl.toFixed(4), stockValue: g.value.toFixed(4), difference: diff.toFixed(4), warehouses: g.warehouses,
    });
    if (Math.abs(diff) > TOLERANCE) {
      const amt = Math.abs(diff).toFixed(4);
      // stock above ledger → raise the inventory account; below → lower it. The other side is stock adjustment.
      suggestedLines.push(diff > 0
        ? { accountId, debitAmount: amt, creditAmount: '0' }
        : { accountId, debitAmount: '0', creditAmount: amt });
      suggestedLines.push(diff > 0
        ? { accountId: g.adjustment, debitAmount: '0', creditAmount: amt }
        : { accountId: g.adjustment, debitAmount: amt, creditAmount: '0' });
    }
  }
  return {
    accounts, unmappedWarehouses: unmapped, totalDifference: total.toFixed(4),
    balanced: accounts.every((a) => Math.abs(Number(a.difference)) <= TOLERANCE), suggestedLines,
  };
}

/** Periodic stock ↔ ledger reconciliation with a proposed correction entry (plan item 35). */
@Injectable()
export class StockGlReconciliationService {
  constructor(
    private readonly repository: InventoryRepository,
    @Optional() private readonly accounting?: AccountingService,
    @Optional() private readonly postingEngine?: PostingEngineService,
  ) {}

  async compare(orgNodeId: string): Promise<StockGlComparison> {
    if (!this.accounting || !this.postingEngine) throw new InventoryValidationError('accounting is not available');
    const warehouses = (await this.repository.listWarehouses()).filter((w) => w.orgNodeId === orgNodeId && !w.isGroup);
    const balances = await this.repository.listBalances();
    const rows = [];
    for (const w of warehouses) {
      const stockValue = balances.filter((b) => b.warehouseId === w.id).reduce((s, b) => s + Number(b.totalValue ?? 0), 0);
      const accounts = await this.postingEngine.resolveStockMovementAccounts(orgNodeId, w.id, 'adjustment', 'inventory');
      rows.push({ id: w.id, code: w.code, stockValue, accounts });
    }
    const gl = new Map((await this.accounting.getAccountBalances()).map((b) => [b.accountId, b]));
    const result = compareStockWithGl(
      rows,
      (id) => { const b = gl.get(id); return b ? Number(b.totalDebit) - Number(b.totalCredit) : 0; },
      (id) => gl.get(id)?.accountCode ?? null,
    );
    return { orgNodeId, asOf: new Date().toISOString(), ...result };
  }

  /** Posts the suggested correction entry (a system entry — stock accounts refuse manual ones, item 32). */
  async postCorrection(orgNodeId: string, reason: string): Promise<{ comparison: StockGlComparison; entry: JournalEntryRecord }> {
    if (!reason?.trim()) throw new InventoryValidationError('a reason is required to post a stock / ledger correction');
    const comparison = await this.compare(orgNodeId);
    if (comparison.suggestedLines.length === 0) throw new InventoryValidationError('المخزون والدفاتر متطابقين — مفيش قيد تصحيح');
    const stamp = new Date().toISOString();
    try {
      return await this.post(orgNodeId, reason.trim(), stamp, comparison);
    } catch (err) {
      // e.g. a closed period — surface it as a 400, not a 500
      if (err instanceof AccountingValidationError || err instanceof AccountingNotFoundError) throw new InventoryValidationError(err.message);
      throw err;
    }
  }

  private async post(orgNodeId: string, reason: string, stamp: string, comparison: StockGlComparison): Promise<{ comparison: StockGlComparison; entry: JournalEntryRecord }> {
    const draft = await this.accounting!.createEntry({
      orgNodeId,
      description: `[Auto] تسوية المخزون مع الدفاتر: ${reason}`,
      reference: `STOCK-GL-${stamp.slice(0, 10)}`,
      isAutoGenerated: true,
      idempotencyKey: `stock-gl-recon-${orgNodeId}-${stamp}`,
      sourceEventType: 'stock_gl_reconciliation',
      lines: comparison.suggestedLines.map((l) => ({ ...l, description: `[Auto] تسوية مخزون/دفاتر` })),
    });
    return { comparison, entry: await this.accounting!.postEntry(draft.id) };
  }
}
