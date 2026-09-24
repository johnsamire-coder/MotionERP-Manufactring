import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { AccountingNotFoundError, AccountingValidationError } from './accounting.errors';
import { AccountingRepository } from './accounting.repository';
import { budget, chartOfAccounts, journalEntry, journalLine } from './accounting.schema';

export type BudgetAction = 'stop' | 'warn' | 'ignore';
export interface BudgetRecord {
  id: string;
  orgNodeId: string;
  fiscalYearId: string;
  accountId: string;
  costCenterId: string | null;
  amount: string;
  monthlyPercentages: number[] | null;
  actionIfExceeded: BudgetAction;
}
export interface BudgetLine {
  accountId: string;
  debitAmount?: string;
  creditAmount?: string;
  costCenterId?: string | null;
}

/** Month index (0-based) of a date counted from the fiscal-year start. */
export function monthIndex(fyStart: Date, date: Date): number {
  return (
    (date.getUTCFullYear() - fyStart.getUTCFullYear()) * 12 +
    date.getUTCMonth() -
    fyStart.getUTCMonth()
  );
}

/** Budget verdict (pure): annual limit, and the accumulated monthly limit when a distribution is set. */
export function evaluateBudget(
  b: { amount: number; monthlyPercentages: number[] | null },
  month: number,
  actualYear: number,
  actualToMonth: number,
  extra: number,
): { annualOver: number; monthlyOver: number; monthlyLimit: number | null } {
  const annualOver = actualYear + extra - b.amount;
  if (!b.monthlyPercentages) return { annualOver, monthlyOver: -Infinity, monthlyLimit: null };
  const pct = b.monthlyPercentages
    .slice(0, Math.max(0, Math.min(11, month)) + 1)
    .reduce((s, p) => s + p, 0);
  const monthlyLimit = (b.amount * pct) / 100;
  return { annualOver, monthlyOver: actualToMonth + extra - monthlyLimit, monthlyLimit };
}

/** Budget control built into every journal entry (plan item 40). */
@Injectable()
export class BudgetService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: AccountingRepository,
  ) {}

  async list(fiscalYearId?: string): Promise<BudgetRecord[]> {
    const q = this.database.db.select().from(budget);
    const rows = fiscalYearId ? await q.where(eq(budget.fiscalYearId, fiscalYearId)) : await q;
    return rows.map(toRecord);
  }

  async upsert(input: {
    fiscalYearId: string;
    accountId: string;
    costCenterId?: string | null;
    amount: string;
    monthlyPercentages?: number[] | null;
    actionIfExceeded?: BudgetAction;
  }): Promise<BudgetRecord> {
    const fy = await this.repository.findFiscalYearById(input.fiscalYearId);
    if (!fy) throw new AccountingNotFoundError(`fiscal year ${input.fiscalYearId} does not exist`);
    if (fy.isClosed) throw new AccountingValidationError(`السنة "${fy.name}" مقفولة`);
    const account = await this.repository.findAccountById(input.accountId);
    if (!account) throw new AccountingNotFoundError(`account ${input.accountId} does not exist`);
    if (account.orgNodeId !== fy.orgNodeId)
      throw new AccountingValidationError(`الحساب ${account.code} تبع شركة تانية`);
    const type = await this.repository.findAccountTypeById(account.accountTypeId);
    if (!type || !['expense', 'cogs'].includes(type.code))
      throw new AccountingValidationError(
        `الموازنة بتتعمل على حسابات المصروفات والتكاليف بس (الحساب ${account.code} نوعه ${type?.code ?? '?'})`,
      );
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0)
      throw new AccountingValidationError('amount must be a non-negative number');
    const pct = input.monthlyPercentages ?? null;
    if (
      pct &&
      (pct.length !== 12 ||
        pct.some((p) => !(p >= 0)) ||
        Math.abs(pct.reduce((s, p) => s + p, 0) - 100) > 0.001)
    ) {
      throw new AccountingValidationError(
        'monthlyPercentages must be 12 non-negative numbers adding up to 100',
      );
    }
    const values = {
      orgNodeId: fy.orgNodeId,
      fiscalYearId: fy.id,
      accountId: account.id,
      costCenterId: input.costCenterId ?? null,
      amount: amount.toFixed(4),
      monthlyPercentages: pct ? JSON.stringify(pct) : null,
      actionIfExceeded: input.actionIfExceeded ?? 'stop',
      updatedAt: new Date(),
    };
    const rows = await this.database.db
      .insert(budget)
      .values(values)
      .onConflictDoUpdate({
        target: [budget.fiscalYearId, budget.accountId, budget.costCenterId],
        set: values,
      })
      .returning();
    return toRecord(rows[0]!);
  }

  /**
   * Checks an entry's lines against every budget they touch. "stop" throws; "warn" returns the messages.
   * `excludeEntryId` keeps the entry itself out of the actuals when it is re-checked at posting.
   */
  async check(
    orgNodeId: string,
    entryDate: Date,
    lines: BudgetLine[],
    excludeEntryId?: string,
  ): Promise<string[]> {
    const fy = await this.repository.findFiscalYearByDate(orgNodeId, entryDate);
    if (!fy) return [];
    const warnings: string[] = [];
    const net = new Map<string, number>(); // accountId|costCenterId → net debit of this entry
    for (const l of lines) {
      const key = `${l.accountId}|${l.costCenterId ?? ''}`;
      net.set(key, (net.get(key) ?? 0) + Number(l.debitAmount ?? 0) - Number(l.creditAmount ?? 0));
    }
    const accountIds = [...new Set(lines.map((l) => l.accountId))];
    const budgets = (
      await this.database.db.select().from(budget).where(eq(budget.fiscalYearId, fy.id))
    ).filter((b) => accountIds.includes(b.accountId));
    for (const b of budgets) {
      // a cost-center budget sees only its cost center; a company-wide budget sees every line of the account
      const extra = [...net.entries()]
        .filter(
          ([k]) =>
            k.startsWith(`${b.accountId}|`) &&
            (!b.costCenterId || k.endsWith(`|${b.costCenterId}`)),
        )
        .reduce((s, [, v]) => s + v, 0);
      if (extra <= 0 || b.actionIfExceeded === 'ignore') continue;
      const fyStart = new Date(fy.startDate);
      const month = monthIndex(fyStart, entryDate);
      const monthEnd = new Date(
        Date.UTC(fyStart.getUTCFullYear(), fyStart.getUTCMonth() + month + 1, 0, 23, 59, 59, 999),
      );
      const actualYear = await this.actual(
        b.accountId,
        b.costCenterId,
        orgNodeId,
        fyStart,
        new Date(fy.endDate),
        excludeEntryId,
      );
      const actualToMonth = await this.actual(
        b.accountId,
        b.costCenterId,
        orgNodeId,
        fyStart,
        monthEnd,
        excludeEntryId,
      );
      const v = evaluateBudget(
        {
          amount: Number(b.amount),
          monthlyPercentages: b.monthlyPercentages
            ? (JSON.parse(b.monthlyPercentages) as number[])
            : null,
        },
        month,
        actualYear,
        actualToMonth,
        extra,
      );
      const code =
        (
          await this.database.db
            .select({ c: chartOfAccounts.code })
            .from(chartOfAccounts)
            .where(eq(chartOfAccounts.id, b.accountId))
            .limit(1)
        )[0]?.c ?? b.accountId;
      const scope = b.costCenterId ? ' (مركز التكلفة)' : '';
      const msgs: string[] = [];
      if (v.annualOver > 0.0001)
        msgs.push(
          `الحساب ${code}${scope} هيعدّي موازنة السنة ${Number(b.amount).toFixed(2)} بمقدار ${v.annualOver.toFixed(2)}`,
        );
      if (v.monthlyOver > 0.0001)
        msgs.push(
          `الحساب ${code}${scope} هيعدّي الموازنة المتراكمة لحد الشهر ${month + 1} (${v.monthlyLimit!.toFixed(2)}) بمقدار ${v.monthlyOver.toFixed(2)}`,
        );
      if (msgs.length === 0) continue;
      if (b.actionIfExceeded === 'stop')
        throw new AccountingValidationError(`تجاوز الموازنة: ${msgs.join(' — ')}`);
      warnings.push(...msgs);
    }
    return warnings;
  }

  /** Budget vs actual per budget line of a fiscal year. */
  async variance(
    fiscalYearId: string,
  ): Promise<Array<BudgetRecord & { actual: string; remaining: string; usedPercent: string }>> {
    const fy = await this.repository.findFiscalYearById(fiscalYearId);
    if (!fy) throw new AccountingNotFoundError(`fiscal year ${fiscalYearId} does not exist`);
    const out = [];
    for (const b of await this.list(fiscalYearId)) {
      const actual = await this.actual(
        b.accountId,
        b.costCenterId,
        fy.orgNodeId,
        new Date(fy.startDate),
        new Date(fy.endDate),
      );
      const amt = Number(b.amount);
      out.push({
        ...b,
        actual: actual.toFixed(4),
        remaining: (amt - actual).toFixed(4),
        usedPercent: amt > 0 ? ((actual / amt) * 100).toFixed(2) : '0.00',
      });
    }
    return out;
  }

  private async actual(
    accountId: string,
    costCenterId: string | null,
    orgNodeId: string,
    from: Date,
    to: Date,
    excludeEntryId?: string,
  ): Promise<number> {
    const conds = [
      eq(journalLine.accountId, accountId),
      eq(journalEntry.orgNodeId, orgNodeId),
      eq(journalEntry.status, 'posted'),
      sql`${journalEntry.entryDate} >= ${from}`,
      sql`${journalEntry.entryDate} <= ${to}`,
    ];
    if (costCenterId) conds.push(eq(journalLine.costCenterId, costCenterId));
    if (excludeEntryId) conds.push(sql`${journalEntry.id} <> ${excludeEntryId}`);
    const rows = await this.database.db
      .select({
        v: sql<string>`coalesce(sum(${journalLine.debitAmount} - ${journalLine.creditAmount}), 0)`,
      })
      .from(journalLine)
      .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id))
      .where(and(...conds));
    return Number(rows[0]?.v ?? 0);
  }
}

function toRecord(r: typeof budget.$inferSelect): BudgetRecord {
  return {
    id: r.id,
    orgNodeId: r.orgNodeId,
    fiscalYearId: r.fiscalYearId,
    accountId: r.accountId,
    costCenterId: r.costCenterId,
    amount: r.amount,
    monthlyPercentages: r.monthlyPercentages
      ? (JSON.parse(r.monthlyPercentages) as number[])
      : null,
    actionIfExceeded: r.actionIfExceeded as BudgetAction,
  };
}
