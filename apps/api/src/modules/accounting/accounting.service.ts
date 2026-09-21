import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AccountingNotFoundError, AccountingValidationError } from './accounting.errors';
import { AccountingRepository } from './accounting.repository';
import type {
  AccountBalance,
  AccountDeterminationRecord,
  AccountingPeriodRecord,
  AccountingPeriodStatus,
  AccountTypeRecord,
  BalanceSheetReport,
  ChartOfAccountsRecord,
  CompanyAccountingConfigRecord,
  CostCenterRecord,
  CreateAccountDeterminationInput,
  CreateAccountingPeriodInput,
  CreateAccountTypeInput,
  CreateChartOfAccountsInput,
  CreateCostCenterInput,
  CreateFiscalYearInput,
  CreateFixedAssetInput,
  CreateJournalEntryInput,
  CreateJournalLineInput,
  DepreciationEntryRecord,
  FiscalYearRecord,
  FixedAssetRecord,
  FixedAssetStatus,
  JournalEntryRecord,
  PartnerLedgerReport,
  PartnerLedgerRow,
  PostDepreciationResult,
  ProfitAndLossReport,
  TrialBalanceReport,
  UpsertCompanyAccountingConfigInput,
  VatReportSummary,
  VatSettlementResult,
} from './accounting.types';

@Injectable()
export class AccountingService {
  constructor(private readonly repository: AccountingRepository) {}

  // --- Account Types ---
  async getAccountTypes(): Promise<AccountTypeRecord[]> {
    return this.repository.listAccountTypes();
  }

  async createAccountType(input: CreateAccountTypeInput): Promise<AccountTypeRecord> {
    const code = input.code.trim().toLowerCase();
    if (!code) throw new AccountingValidationError('code is required');
    const existing = await this.repository.findAccountTypeByCode(code);
    if (existing) throw new AccountingValidationError(`an account type with code "${code}" already exists`);
    return this.repository.insertAccountType({ id: randomUUID(), code, name: input.name.trim(), normalBalance: input.normalBalance });
  }

  // --- Chart of Accounts ---
  async getAccounts(): Promise<ChartOfAccountsRecord[]> {
    return this.repository.listAccounts();
  }

  async createAccount(input: CreateChartOfAccountsInput): Promise<ChartOfAccountsRecord> {
    const code = input.code.trim();
    if (!code) throw new AccountingValidationError('code is required');
    if (!input.orgNodeId) throw new AccountingValidationError('orgNodeId is required');

    const existing = await this.repository.findAccountByCode(input.orgNodeId, code);
    if (existing) throw new AccountingValidationError(`an account with code "${code}" already exists for this company`);

    const accountType = await this.repository.findAccountTypeById(input.accountTypeId);
    if (!accountType) throw new AccountingNotFoundError(`account type ${input.accountTypeId} does not exist`);

    if (input.parentId) {
      const parent = await this.repository.findAccountById(input.parentId);
      if (!parent) throw new AccountingNotFoundError(`parent account ${input.parentId} does not exist`);
      if (parent.orgNodeId !== input.orgNodeId) {
        throw new AccountingValidationError(`parent account "${parent.code}" belongs to a different company`);
      }
      await this.repository.markAsParent(input.parentId);
    }

    return this.repository.insertAccount({
      id: randomUUID(),
      code,
      name: input.name.trim(),
      orgNodeId: input.orgNodeId,
      accountTypeId: input.accountTypeId,
      parentId: input.parentId,
    });
  }

  // --- Fiscal Years ---
  async getFiscalYears(orgNodeId?: string): Promise<FiscalYearRecord[]> {
    return this.repository.listFiscalYears(orgNodeId);
  }

  async createFiscalYear(input: CreateFiscalYearInput): Promise<FiscalYearRecord> {
    if (!input.orgNodeId) throw new AccountingValidationError('orgNodeId is required');
    if (!input.name || input.name.trim().length === 0) throw new AccountingValidationError('fiscal year name is required');
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new AccountingValidationError('invalid start or end date');
    if (end <= start) throw new AccountingValidationError('end date must be after start date');

    const fy = await this.repository.insertFiscalYear({ id: randomUUID(), ...input });

    for (let month = 1; month <= 12; month++) {
      const pStart = new Date(start.getFullYear(), start.getMonth() + month - 1, 1);
      const pEnd = new Date(start.getFullYear(), start.getMonth() + month, 0, 23, 59, 59, 999);
      const pName = `M${String(month).padStart(2, '0')}-${pStart.toLocaleString('default', { month: 'short', year: 'numeric' })}`;
      await this.repository.insertPeriod({
        id: randomUUID(),
        fiscalYearId: fy.id,
        periodNumber: month,
        name: pName,
        startDate: pStart.toISOString(),
        endDate: pEnd.toISOString(),
      });
    }

    return fy;
  }

  async closeFiscalYear(id: string): Promise<void> {
    const fy = await this.repository.findFiscalYearById(id);
    if (!fy) throw new AccountingNotFoundError(`fiscal year ${id} does not exist`);
    await this.repository.closeFiscalYear(id);
  }

  // --- Accounting Periods ---
  async getPeriods(fiscalYearId: string): Promise<AccountingPeriodRecord[]> {
    return this.repository.listPeriods(fiscalYearId);
  }

  async setPeriodStatus(id: string, status: AccountingPeriodStatus): Promise<AccountingPeriodRecord> {
    const period = await this.repository.findPeriodById(id);
    if (!period) throw new AccountingNotFoundError(`accounting period ${id} does not exist`);
    return this.repository.setPeriodStatus(id, status);
  }

  // --- Cost Centers ---
  async getCostCenters(orgNodeId?: string): Promise<CostCenterRecord[]> {
    return this.repository.listCostCenters(orgNodeId);
  }

  async createCostCenter(input: CreateCostCenterInput): Promise<CostCenterRecord> {
    if (!input.orgNodeId) throw new AccountingValidationError('orgNodeId is required');
    const code = input.code.trim();
    if (!code) throw new AccountingValidationError('code is required');
    const existing = await this.repository.findCostCenterByCode(input.orgNodeId, code);
    if (existing) throw new AccountingValidationError(`cost center "${code}" already exists for this company`);

    return this.repository.insertCostCenter({ id: randomUUID(), ...input, code, name: input.name.trim() });
  }

  // --- Company Accounting Config ---
  async getCompanyConfig(orgNodeId: string): Promise<CompanyAccountingConfigRecord | null> {
    return this.repository.findCompanyConfig(orgNodeId);
  }

  async upsertCompanyConfig(input: UpsertCompanyAccountingConfigInput): Promise<CompanyAccountingConfigRecord> {
    if (!input.orgNodeId) throw new AccountingValidationError('orgNodeId is required');
    return this.repository.upsertCompanyConfig({ id: randomUUID(), ...input });
  }

  // --- Account Determination ---
  async getAccountDeterminations(orgNodeId: string): Promise<AccountDeterminationRecord[]> {
    return this.repository.listAccountDeterminations(orgNodeId);
  }

  async createAccountDetermination(input: CreateAccountDeterminationInput): Promise<AccountDeterminationRecord> {
    if (!input.orgNodeId) throw new AccountingValidationError('orgNodeId is required');
    return this.repository.insertAccountDetermination({ id: randomUUID(), ...input });
  }

  // --- Journal Entries ---
  async getEntries(): Promise<JournalEntryRecord[]> {
    return this.repository.listEntries();
  }

  async getEntry(id: string): Promise<JournalEntryRecord> {
    const found = await this.repository.findEntryById(id);
    if (!found) throw new AccountingNotFoundError(`journal entry ${id} does not exist`);
    return found;
  }

  async createEntry(input: CreateJournalEntryInput): Promise<JournalEntryRecord> {
    if (!input.orgNodeId) throw new AccountingValidationError('orgNodeId is required');
    if (!input.lines || input.lines.length < 2) {
      throw new AccountingValidationError('a journal entry needs at least two lines (double-entry)');
    }
    if (!input.description || input.description.trim().length === 0) {
      throw new AccountingValidationError('description is required');
    }

    const entryDate = input.entryDate ? new Date(input.entryDate) : new Date();

    let fyId = input.fiscalYearId;
    let pId = input.periodId;
    if (!fyId || !pId) {
      const fy = await this.repository.findFiscalYearByDate(input.orgNodeId, entryDate);
      if (fy) {
        fyId = fy.id;
        const period = await this.repository.findPeriodByDate(fy.id, entryDate);
        if (period) {
          if (period.status !== 'open') {
            throw new AccountingValidationError(`accounting period "${period.name}" is ${period.status}; cannot post into closed periods`);
          }
          pId = period.id;
        }
      }
    }

    for (const line of input.lines) {
      const debit = Number(line.debitAmount ?? '0');
      const credit = Number(line.creditAmount ?? '0');
      if (!Number.isFinite(debit) || debit < 0 || !Number.isFinite(credit) || credit < 0) {
        throw new AccountingValidationError('debit and credit amounts cannot be negative');
      }
      if (debit > 0 && credit > 0) throw new AccountingValidationError('a single line cannot have both a debit and a credit amount');
      if (debit === 0 && credit === 0) throw new AccountingValidationError('every line must have either a debit or a credit amount');

      const account = await this.repository.findAccountById(line.accountId);
      if (!account) throw new AccountingNotFoundError(`account ${line.accountId} does not exist`);
      if (!account.isLeaf) throw new AccountingValidationError(`account ${account.code} is a parent account and cannot receive direct postings`);
      if (account.orgNodeId !== input.orgNodeId) {
        throw new AccountingValidationError(`account "${account.code}" belongs to a different company than this journal entry`);
      }
    }

    const sequence = (await this.repository.countEntries()) + 1;
    const year = entryDate.getFullYear();
    const entryNumber = `JE-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertEntry({
      id: randomUUID(),
      entryNumber,
      ...input,
      fiscalYearId: fyId,
      periodId: pId,
    });
  }

  async postEntry(id: string): Promise<JournalEntryRecord> {
    const entry = await this.repository.findEntryById(id);
    if (!entry) throw new AccountingNotFoundError(`journal entry ${id} does not exist`);
    if (entry.status !== 'draft') throw new AccountingValidationError(`journal entry ${id} is "${entry.status}" and cannot be posted (must be "draft")`);

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of entry.lines) {
      totalDebit += Number(line.debitAmount);
      totalCredit += Number(line.creditAmount);
    }
    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      throw new AccountingValidationError(`journal entry does not balance: total debit ${totalDebit.toFixed(2)} != total credit ${totalCredit.toFixed(2)}`);
    }

    return this.repository.setEntryStatus(id, 'posted');
  }

  async cancelEntry(id: string): Promise<JournalEntryRecord> {
    const entry = await this.repository.findEntryById(id);
    if (!entry) throw new AccountingNotFoundError(`journal entry ${id} does not exist`);
    if (entry.status === 'posted') throw new AccountingValidationError(`journal entry ${id} is already posted and cannot be cancelled (reverse it with a new entry instead)`);
    return this.repository.setEntryStatus(id, 'cancelled');
  }

  async getAccountBalances(): Promise<AccountBalance[]> {
    const rows = await this.repository.listAllPostedLinesWithAccounts();
    const byAccount = new Map<string, { code: string; name: string; debit: number; credit: number }>();
    for (const row of rows) {
      const existing = byAccount.get(row.accountId) ?? { code: row.code, name: row.name, debit: 0, credit: 0 };
      existing.debit += Number(row.debit);
      existing.credit += Number(row.credit);
      byAccount.set(row.accountId, existing);
    }
    return Array.from(byAccount.entries()).map(([accountId, v]) => ({
      accountId,
      accountCode: v.code,
      accountName: v.name,
      totalDebit: v.debit.toFixed(4),
      totalCredit: v.credit.toFixed(4),
      balance: (v.debit - v.credit).toFixed(4),
    }));
  }

  // ==================== FIXED ASSETS & DEPRECIATION LOGIC ====================

  async getFixedAssets(orgNodeId?: string): Promise<FixedAssetRecord[]> {
    return this.repository.listFixedAssets(orgNodeId);
  }

  async getFixedAsset(id: string): Promise<FixedAssetRecord> {
    const asset = await this.repository.findFixedAssetById(id);
    if (!asset) throw new AccountingNotFoundError(`fixed asset ${id} does not exist`);
    return asset;
  }

  async createFixedAsset(input: CreateFixedAssetInput): Promise<FixedAssetRecord> {
    if (!input.orgNodeId) throw new AccountingValidationError('orgNodeId is required');
    if (!input.assetCode || input.assetCode.trim().length === 0) throw new AccountingValidationError('assetCode is required');
    if (!input.assetName || input.assetName.trim().length === 0) throw new AccountingValidationError('assetName is required');

    const cost = Number(input.purchaseCost);
    if (!Number.isFinite(cost) || cost <= 0) throw new AccountingValidationError('purchaseCost must be a positive number');

    const life = input.usefulLifeMonths;
    if (!Number.isInteger(life) || life <= 0) throw new AccountingValidationError('usefulLifeMonths must be a positive integer');

    const existing = await this.repository.findFixedAssetByCode(input.orgNodeId, input.assetCode.trim());
    if (existing) throw new AccountingValidationError(`fixed asset with code "${input.assetCode}" already exists for this company`);

    return this.repository.insertFixedAsset({
      ...input,
      id: randomUUID(),
      assetCode: input.assetCode.trim(),
      assetName: input.assetName.trim(),
    });
  }

  async postAssetDepreciation(assetId: string, periodDateStr?: string): Promise<PostDepreciationResult> {
    const asset = await this.getFixedAsset(assetId);
    if (asset.status !== 'active') {
      throw new AccountingValidationError(`fixed asset "${asset.assetName}" is ${asset.status} and cannot be depreciated`);
    }

    const totalCost = Number(asset.purchaseCost);
    const salvage = Number(asset.salvageValue ?? '0');
    const depreciableCost = totalCost - salvage;
    const currentDepreciated = Number(asset.totalDepreciated ?? '0');
    const remainingToDepreciate = depreciableCost - currentDepreciated;

    if (remainingToDepreciate <= 0) {
      await this.repository.updateFixedAssetDepreciation(asset.id, asset.totalDepreciated, 'fully_depreciated');
      throw new AccountingValidationError(`fixed asset "${asset.assetName}" is already fully depreciated`);
    }

    const monthlyAmount = depreciableCost / asset.usefulLifeMonths;
    const actualDepreciationAmount = Math.min(monthlyAmount, remainingToDepreciate);
    const newTotalDepreciated = (currentDepreciated + actualDepreciationAmount).toFixed(4);

    const entryDate = periodDateStr ? new Date(periodDateStr) : new Date();

    const draftJournal = await this.createEntry({
      orgNodeId: asset.orgNodeId,
      description: `[Auto] قسط إهلاك شهري لأصل: ${asset.assetName} (${asset.assetCode})`,
      reference: `DEP-${asset.assetCode}`,
      entryDate: entryDate.toISOString(),
      isAutoGenerated: true,
      idempotencyKey: `asset-depr-${asset.id}-${entryDate.getFullYear()}-${entryDate.getMonth() + 1}`,
      sourceEventType: 'asset_depreciation',
      lines: [
        {
          accountId: asset.depreciationExpenseAccountId,
          debitAmount: actualDepreciationAmount.toFixed(4),
          creditAmount: '0',
          description: `[Auto] مصروف إهلاك: ${asset.assetName}`,
          costCenterId: asset.costCenterId ?? undefined,
        },
        {
          accountId: asset.accumulatedDepreciationAccountId,
          debitAmount: '0',
          creditAmount: actualDepreciationAmount.toFixed(4),
          description: `[Auto] مجمع إهلاك: ${asset.assetName}`,
        },
      ],
    });

    const postedJournal = await this.postEntry(draftJournal.id);

    const deEntry = await this.repository.insertDepreciationEntry({
      id: randomUUID(),
      assetId: asset.id,
      periodId: postedJournal.periodId ?? null,
      entryDate,
      depreciationAmount: actualDepreciationAmount.toFixed(4),
      accumulatedAmountAfter: newTotalDepreciated,
      journalEntryId: postedJournal.id,
    });

    const newStatus: FixedAssetStatus = Number(newTotalDepreciated) >= depreciableCost ? 'fully_depreciated' : 'active';
    await this.repository.updateFixedAssetDepreciation(asset.id, newTotalDepreciated, newStatus);

    const updatedAsset = await this.getFixedAsset(asset.id);

    return {
      asset: updatedAsset,
      depreciationEntry: deEntry,
      journalEntry: postedJournal,
    };
  }

  // ==================== FINANCIAL REPORTS LOGIC ====================

  async getTrialBalance(orgNodeId: string, start?: string, end?: string): Promise<TrialBalanceReport> {
    const lines = await this.repository.listAllPostedLinesWithDetails({ orgNodeId, startDate: start, endDate: end });
    const byAccount = new Map<string, { code: string; name: string; debit: number; credit: number }>();

    for (const l of lines) {
      const current = byAccount.get(l.accountId) ?? { code: l.code, name: l.name, debit: 0, credit: 0 };
      current.debit += Number(l.debit);
      current.credit += Number(l.credit);
      byAccount.set(l.accountId, current);
    }

    let grandDebit = 0;
    let grandCredit = 0;

    const rows = Array.from(byAccount.entries()).map(([id, val]) => {
      grandDebit += val.debit;
      grandCredit += val.credit;
      const netBalance = val.debit - val.credit;
      return {
        accountId: id,
        accountCode: val.code,
        accountName: val.name,
        debit: val.debit.toFixed(4),
        credit: val.credit.toFixed(4),
        balance: netBalance.toFixed(4),
      };
    });

    return {
      orgNodeId,
      startDate: start,
      endDate: end,
      totalDebit: grandDebit.toFixed(4),
      totalCredit: grandCredit.toFixed(4),
      isBalanced: Math.abs(grandDebit - grandCredit) < 0.0001,
      rows,
    };
  }

  async getProfitAndLoss(orgNodeId: string, start?: string, end?: string): Promise<ProfitAndLossReport> {
    const lines = await this.repository.listAllPostedLinesWithDetails({ orgNodeId, startDate: start, endDate: end });
    
    let revenueSum = 0;
    let cogsSum = 0;
    let expenseSum = 0;

    const revMap = new Map<string, number>();
    const expMap = new Map<string, number>();

    for (const l of lines) {
      const netAmount = Number(l.credit) - Number(l.debit);
      const expenseAmount = Number(l.debit) - Number(l.credit);

      if (l.typeCode === 'revenue') {
        revenueSum += netAmount;
        revMap.set(l.name, (revMap.get(l.name) ?? 0) + netAmount);
      } else if (l.typeCode === 'cogs') {
        cogsSum += expenseAmount;
        expMap.set(l.name, (expMap.get(l.name) ?? 0) + expenseAmount);
      } else if (l.typeCode === 'expense') {
        expenseSum += expenseAmount;
        expMap.set(l.name, (expMap.get(l.name) ?? 0) + expenseAmount);
      }
    }

    const grossProfit = revenueSum - cogsSum;
    const netProfit = grossProfit - expenseSum;

    return {
      orgNodeId,
      startDate: start,
      endDate: end,
      totalRevenue: revenueSum.toFixed(4),
      totalCogs: cogsSum.toFixed(4),
      grossProfit: grossProfit.toFixed(4),
      totalExpenses: expenseSum.toFixed(4),
      netProfit: netProfit.toFixed(4),
      revenueDetails: Array.from(revMap.entries()).map(([name, val]) => ({ accountName: name, balance: val.toFixed(4) })),
      expenseDetails: Array.from(expMap.entries()).map(([name, val]) => ({ accountName: name, balance: val.toFixed(4) })),
    };
  }

  async getBalanceSheet(orgNodeId: string, dateStr: string): Promise<BalanceSheetReport> {
    const lines = await this.repository.listAllPostedLinesWithDetails({ orgNodeId, endDate: dateStr });
    const pnl = await this.getProfitAndLoss(orgNodeId, undefined, dateStr);

    let assetsSum = 0;
    let liabilitiesSum = 0;
    let equitySum = 0;

    const assetMap = new Map<string, number>();
    const liabMap = new Map<string, number>();
    const eqMap = new Map<string, number>();

    for (const l of lines) {
      const assetBal = Number(l.debit) - Number(l.credit);
      const liabEqBal = Number(l.credit) - Number(l.debit);

      if (l.typeCode === 'asset' || l.typeCode === 'wip') {
        assetsSum += assetBal;
        assetMap.set(l.name, (assetMap.get(l.name) ?? 0) + assetBal);
      } else if (l.typeCode === 'liability') {
        liabilitiesSum += liabEqBal;
        liabMap.set(l.name, (liabMap.get(l.name) ?? 0) + liabEqBal);
      } else if (l.typeCode === 'equity') {
        equitySum += liabEqBal;
        eqMap.set(l.name, (eqMap.get(l.name) ?? 0) + liabEqBal);
      }
    }

    const currentNetProfit = Number(pnl.netProfit);
    equitySum += currentNetProfit;
    eqMap.set('صافي أرباح الفترة الحالية', (eqMap.get('صافي أرباح الفترة الحالية') ?? 0) + currentNetProfit);

    const totalLiabilitiesAndEquity = liabilitiesSum + equitySum;

    return {
      orgNodeId,
      date: dateStr,
      totalAssets: assetsSum.toFixed(4),
      totalLiabilities: liabilitiesSum.toFixed(4),
      totalEquity: equitySum.toFixed(4),
      totalLiabilitiesAndEquity: totalLiabilitiesAndEquity.toFixed(4),
      isBalanced: Math.abs(assetsSum - totalLiabilitiesAndEquity) < 0.001,
      assets: Array.from(assetMap.entries()).map(([name, val]) => ({ accountName: name, balance: val.toFixed(4) })),
      liabilities: Array.from(liabMap.entries()).map(([name, val]) => ({ accountName: name, balance: val.toFixed(4) })),
      equity: Array.from(eqMap.entries()).map(([name, val]) => ({ accountName: name, balance: val.toFixed(4) })),
    };
  }

  async getPartnerLedger(partyType: 'customer' | 'supplier', partyId: string, start?: string, end?: string): Promise<PartnerLedgerReport> {
    const rawLines = await this.repository.getPartnerLedgerLines(partyType, partyId);

    let openingBal = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const filteredRows: PartnerLedgerRow[] = [];
    let runningBalance = 0;

    for (const row of rawLines) {
      const entryDate = row.entryDate;
      const dr = Number(row.debitAmount);
      const cr = Number(row.creditAmount);
      const effect = partyType === 'customer' ? (dr - cr) : (cr - dr);

      if (start && entryDate < new Date(start)) {
        openingBal += effect;
        runningBalance += effect;
      } else if (end && entryDate > new Date(end)) {
        // Skip
      } else {
        totalDebit += dr;
        totalCredit += cr;
        runningBalance += effect;
        filteredRows.push({
          journalEntryId: row.journalEntryId,
          entryNumber: row.entryNumber,
          entryDate: entryDate.toISOString(),
          description: row.description || '',
          debit: dr.toFixed(4),
          credit: cr.toFixed(4),
          runningBalance: runningBalance.toFixed(4),
        });
      }
    }

    return {
      partyType,
      partyId,
      startDate: start,
      endDate: end,
      openingBalance: openingBal.toFixed(4),
      totalDebit: totalDebit.toFixed(4),
      totalCredit: totalCredit.toFixed(4),
      closingBalance: runningBalance.toFixed(4),
      rows: filteredRows,
    };
  }

  // ==================== VAT RETURN & TAX SETTLEMENT ENGINE ====================

  async getVatReport(orgNodeId: string, startDate?: string, endDate?: string): Promise<VatReportSummary> {
    const config = await this.repository.findCompanyConfig(orgNodeId);
    const determinations = await this.repository.listAccountDeterminations(orgNodeId);

    const inputTaxDet = determinations.find((d) => d.accountPurpose === 'input_tax');
    const inputTaxAccountId = inputTaxDet?.accountId ?? config?.defaultInputTaxAccountId;

    const outputTaxDet = determinations.find((d) => d.accountPurpose === 'output_tax');
    const outputTaxAccountId = outputTaxDet?.accountId ?? config?.defaultOutputTaxAccountId;

    const lines = await this.repository.listAllPostedLinesWithDetails({ orgNodeId, startDate, endDate });

    let totalInputTax = 0;
    let totalOutputTax = 0;

    for (const l of lines) {
      if (inputTaxAccountId && l.accountId === inputTaxAccountId) {
        totalInputTax += Number(l.debit) - Number(l.credit);
      }
      if (outputTaxAccountId && l.accountId === outputTaxAccountId) {
        totalOutputTax += Number(l.credit) - Number(l.debit);
      }
    }

    const netTaxPayable = totalOutputTax - totalInputTax;

    return {
      orgNodeId,
      startDate,
      endDate,
      totalOutputTax: totalOutputTax.toFixed(4),
      totalInputTax: totalInputTax.toFixed(4),
      netTaxPayable: Math.abs(netTaxPayable).toFixed(4),
      status: netTaxPayable >= 0 ? 'payable' : 'refundable',
    };
  }

  async postVatSettlement(
    orgNodeId: string,
    settlementDateStr: string,
    taxAuthorityPayableAccountId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<VatSettlementResult> {
    const vatSummary = await this.getVatReport(orgNodeId, startDate, endDate);
    const config = await this.repository.findCompanyConfig(orgNodeId);
    const determinations = await this.repository.listAccountDeterminations(orgNodeId);

    const inputTaxDet = determinations.find((d) => d.accountPurpose === 'input_tax');
    const inputTaxAccountId = inputTaxDet?.accountId ?? config?.defaultInputTaxAccountId;

    const outputTaxDet = determinations.find((d) => d.accountPurpose === 'output_tax');
    const outputTaxAccountId = outputTaxDet?.accountId ?? config?.defaultOutputTaxAccountId;

    if (!inputTaxAccountId || !outputTaxAccountId) {
      throw new AccountingValidationError('حسابات ضريبة المدخلات وضريبة المخرجات يجب تعيينها أولاً للشركة');
    }

    const outTax = Number(vatSummary.totalOutputTax);
    const inTax = Number(vatSummary.totalInputTax);
    const netPayable = Number(vatSummary.netTaxPayable);

    const lines: CreateJournalLineInput[] = [];

    // 1. Clear Output VAT (Debit Output Tax)
    if (outTax > 0) {
      lines.push({
        accountId: outputTaxAccountId,
        debitAmount: vatSummary.totalOutputTax,
        creditAmount: '0',
        description: `[Auto] إقفال ضريبة المخرجات لإقرار ${settlementDateStr}`,
      });
    }

    // 2. Clear Input VAT (Credit Input Tax)
    if (inTax > 0) {
      lines.push({
        accountId: inputTaxAccountId,
        debitAmount: '0',
        creditAmount: vatSummary.totalInputTax,
        description: `[Auto] تسوية وخصم ضريبة المدخلات لإقرار ${settlementDateStr}`,
      });
    }

    // 3. Tax Authority Payable / Refundable
    if (vatSummary.status === 'payable' && netPayable > 0) {
      lines.push({
        accountId: taxAuthorityPayableAccountId,
        debitAmount: '0',
        creditAmount: vatSummary.netTaxPayable,
        description: `[Auto] إثبات صافي ضريبة القيمة المضافة المستحقة للسداد لمصلحة الضرائب`,
      });
    } else if (vatSummary.status === 'refundable' && netPayable > 0) {
      lines.push({
        accountId: taxAuthorityPayableAccountId,
        debitAmount: vatSummary.netTaxPayable,
        creditAmount: '0',
        description: `[Auto] إثبات رصيد دائن مسترد من ضريبة القيمة المضافة طرف مصلحة الضرائب`,
      });
    }

    const settlementDate = new Date(settlementDateStr);
    const draftJournal = await this.createEntry({
      orgNodeId,
      description: `[Auto] تسوية وإقرار ضريبة القيمة المضافة 14% لشهر ${settlementDate.getFullYear()}-${settlementDate.getMonth() + 1}`,
      reference: `VAT-${settlementDate.getFullYear()}-${settlementDate.getMonth() + 1}`,
      entryDate: settlementDate.toISOString(),
      isAutoGenerated: true,
      idempotencyKey: `vat-settle-${orgNodeId}-${settlementDate.getFullYear()}-${settlementDate.getMonth() + 1}`,
      sourceEventType: 'vat_settlement',
      lines,
    });

    const postedJournal = await this.postEntry(draftJournal.id);

    return {
      journalEntry: postedJournal,
      vatSummary,
    };
  }
}