import { Injectable } from '@nestjs/common';
import { AccountingNotFoundError, AccountingValidationError } from './accounting.errors';
import { AccountingRepository } from './accounting.repository';
import { AccountingService } from './accounting.service';
import type { JournalEntryRecord } from './accounting.types';

/** Account type codes the P&L report treats as profit & loss (same classification, accounting.service). */
export const PNL_TYPE_CODES = ['revenue', 'cogs', 'expense'] as const;

export interface ClosingLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitAmount: string;
  creditAmount: string;
}
export interface YearEndPreview {
  fiscalYearId: string;
  fiscalYearName: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  totalRevenue: string;
  totalCostsAndExpenses: string;
  netProfit: string;
  draftEntries: number;
  trialBalanceDebit: string;
  trialBalanceCredit: string;
  closingLines: ClosingLine[];
  ready: boolean;
  problems: string[];
}

/** Closing lines that zero every P&L account, with the net going to retained earnings (pure). */
export function buildClosingLines(
  balances: Array<{
    accountId: string;
    code: string;
    name: string;
    typeCode: string;
    debit: number;
    credit: number;
  }>,
  retained: { id: string; code: string; name: string } | null,
): { lines: ClosingLine[]; revenue: number; costs: number; netProfit: number } {
  const byAccount = new Map<
    string,
    { code: string; name: string; typeCode: string; net: number }
  >();
  for (const b of balances) {
    if (!(PNL_TYPE_CODES as readonly string[]).includes(b.typeCode)) continue;
    const cur = byAccount.get(b.accountId) ?? {
      code: b.code,
      name: b.name,
      typeCode: b.typeCode,
      net: 0,
    };
    cur.net += b.debit - b.credit; // debit-positive
    byAccount.set(b.accountId, cur);
  }
  const lines: ClosingLine[] = [];
  let revenue = 0;
  let costs = 0;
  for (const [accountId, a] of byAccount) {
    const net = Number(a.net.toFixed(4));
    if (a.typeCode === 'revenue') revenue += -net;
    else costs += net;
    if (net === 0) continue;
    const amt = Math.abs(net).toFixed(4);
    lines.push({
      accountId,
      accountCode: a.code,
      accountName: a.name,
      debitAmount: net < 0 ? amt : '0',
      creditAmount: net > 0 ? amt : '0',
    });
  }
  const netProfit = Number((revenue - costs).toFixed(4));
  if (retained && netProfit !== 0) {
    const amt = Math.abs(netProfit).toFixed(4);
    lines.push({
      accountId: retained.id,
      accountCode: retained.code,
      accountName: retained.name,
      debitAmount: netProfit < 0 ? amt : '0',
      creditAmount: netProfit > 0 ? amt : '0',
    });
  }
  return { lines, revenue, costs, netProfit };
}

/**
 * Real year-end closing (plan item 36): P&L accounts are zeroed into retained earnings by a posted
 * closing entry, then every period and the year are closed — after which the code itself refuses any
 * entry dated inside the year (AccountingService.assertOpenForPosting).
 * It replaces the older fixed-figure period/fiscal-year closing services, which were removed.
 */
@Injectable()
export class YearEndClosingService {
  constructor(
    private readonly repository: AccountingRepository,
    private readonly accounting: AccountingService,
  ) {}

  async preview(fiscalYearId: string, retainedEarningsAccountId?: string): Promise<YearEndPreview> {
    const fy = await this.repository.findFiscalYearById(fiscalYearId);
    if (!fy) throw new AccountingNotFoundError(`fiscal year ${fiscalYearId} does not exist`);
    const problems: string[] = [];
    if (fy.isClosed) problems.push(`السنة "${fy.name}" مقفولة بالفعل`);

    const closing = new Set(
      await this.repository.listEntryIdsBySourceForCompany(fy.orgNodeId, 'period_closing'),
    );
    const rows = (
      await this.repository.listAllPostedLinesWithDetails({
        orgNodeId: fy.orgNodeId,
        startDate: fy.startDate,
        endDate: fy.endDate,
      })
    ).filter((r) => !closing.has(r.journalEntryId));
    const tbDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
    const tbCredit = rows.reduce((s, r) => s + Number(r.credit), 0);
    if (Math.abs(tbDebit - tbCredit) > 0.001)
      problems.push(
        `ميزان المراجعة مش متوازن: مدين ${tbDebit.toFixed(2)} ≠ دائن ${tbCredit.toFixed(2)}`,
      );

    const drafts = await this.repository.countDraftEntries(
      fy.orgNodeId,
      new Date(fy.startDate),
      new Date(fy.endDate),
    );
    if (drafts > 0) problems.push(`فيه ${drafts} قيد مسودة جوه السنة — رحّلها أو الغيها الأول`);

    const retained = retainedEarningsAccountId
      ? await this.checkRetained(retainedEarningsAccountId, fy.orgNodeId, problems)
      : null;
    const built = buildClosingLines(
      rows.map((r) => ({
        accountId: r.accountId,
        code: r.code,
        name: r.name,
        typeCode: r.typeCode,
        debit: Number(r.debit),
        credit: Number(r.credit),
      })),
      retained,
    );
    if (!retainedEarningsAccountId && built.netProfit !== 0)
      problems.push('لازم تحدد حساب الأرباح المحتجزة');

    return {
      fiscalYearId: fy.id,
      fiscalYearName: fy.name,
      startDate: fy.startDate,
      endDate: fy.endDate,
      isClosed: fy.isClosed,
      totalRevenue: built.revenue.toFixed(4),
      totalCostsAndExpenses: built.costs.toFixed(4),
      netProfit: built.netProfit.toFixed(4),
      draftEntries: drafts,
      trialBalanceDebit: tbDebit.toFixed(4),
      trialBalanceCredit: tbCredit.toFixed(4),
      closingLines: built.lines,
      ready: problems.length === 0,
      problems,
    };
  }

  async close(
    fiscalYearId: string,
    retainedEarningsAccountId: string,
  ): Promise<{ preview: YearEndPreview; closingEntry: JournalEntryRecord | null }> {
    const preview = await this.preview(fiscalYearId, retainedEarningsAccountId);
    if (!preview.ready)
      throw new AccountingValidationError(`مينفعش تقفل السنة: ${preview.problems.join(' — ')}`);
    const fy = (await this.repository.findFiscalYearById(fiscalYearId))!;

    let closingEntry: JournalEntryRecord | null = null;
    if (preview.closingLines.length >= 2) {
      // Posted while the last period is still open; the periods and the year close right after.
      const draft = await this.accounting.createEntry({
        orgNodeId: fy.orgNodeId,
        description: `[Auto] إقفال السنة المالية ${fy.name}: تصفير الإيرادات والمصروفات في الأرباح المحتجزة`,
        reference: `FY-CLOSE-${fy.name}`,
        entryDate: fy.endDate,
        isAutoGenerated: true,
        idempotencyKey: `fy-close-${fy.id}`,
        sourceEventType: 'period_closing',
        lines: preview.closingLines.map((l) => ({
          accountId: l.accountId,
          debitAmount: l.debitAmount,
          creditAmount: l.creditAmount,
          description: '[Auto] إقفال سنوي',
        })),
      });
      closingEntry = await this.accounting.postEntry(draft.id);
    }
    for (const p of await this.repository.listPeriods(fy.id)) {
      if (p.status === 'open') await this.repository.setPeriodStatus(p.id, 'closed');
    }
    await this.repository.closeFiscalYear(fy.id);
    return { preview: { ...preview, isClosed: true }, closingEntry };
  }

  private async checkRetained(
    id: string,
    orgNodeId: string,
    problems: string[],
  ): Promise<{ id: string; code: string; name: string } | null> {
    const acc = await this.repository.findAccountById(id);
    if (!acc) {
      problems.push('حساب الأرباح المحتجزة مش موجود');
      return null;
    }
    if (acc.orgNodeId !== orgNodeId) problems.push(`الحساب ${acc.code} تبع شركة تانية`);
    if (!acc.isLeaf) problems.push(`الحساب ${acc.code} حساب أب`);
    const type = await this.repository.findAccountTypeById(acc.accountTypeId);
    const role = await this.repository.findAccountRole(id);
    if (type?.code !== 'equity' && role !== 'equity')
      problems.push(`الحساب ${acc.code} مش حساب حقوق ملكية`);
    return { id: acc.id, code: acc.code, name: acc.name };
  }
}
