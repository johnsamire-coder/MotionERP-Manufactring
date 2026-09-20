import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AccountingNotFoundError, AccountingValidationError } from './accounting.errors';
import { AccountingRepository } from './accounting.repository';
import type {
  AccountBalance, AccountDeterminationRecord, AccountingPeriodRecord,
  AccountingPeriodStatus, AccountTypeRecord, ChartOfAccountsRecord,
  CompanyAccountingConfigRecord, CostCenterRecord, CreateAccountDeterminationInput,
  CreateAccountingPeriodInput, CreateAccountTypeInput, CreateChartOfAccountsInput,
  CreateCostCenterInput, CreateFiscalYearInput, CreateJournalEntryInput,
  FiscalYearRecord, JournalEntryRecord, UpsertCompanyAccountingConfigInput,
} from './accounting.types';

@Injectable()
export class AccountingService {
  constructor(private readonly repository: AccountingRepository) {}

  // --- Account Types ---
  async getAccountTypes(): Promise<AccountTypeRecord[]> { return this.repository.listAccountTypes(); }
  async createAccountType(input: CreateAccountTypeInput): Promise<AccountTypeRecord> {
    const code = input.code.trim().toLowerCase();
    if (!code) throw new AccountingValidationError('code is required');
    const existing = await this.repository.findAccountTypeByCode(code);
    if (existing) throw new AccountingValidationError(`an account type with code "${code}" already exists`);
    return this.repository.insertAccountType({ id: randomUUID(), code, name: input.name.trim(), normalBalance: input.normalBalance });
  }

  // --- Chart of Accounts ---
  async getAccounts(): Promise<ChartOfAccountsRecord[]> { return this.repository.listAccounts(); }
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
      id: randomUUID(), code, name: input.name.trim(), orgNodeId: input.orgNodeId,
      accountTypeId: input.accountTypeId, parentId: input.parentId,
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

    // Automatically generate 12 monthly periods
    for (let month = 1; month <= 12; month++) {
      const pStart = new Date(start.getFullYear(), start.getMonth() + month - 1, 1);
      const pEnd = new Date(start.getFullYear(), start.getMonth() + month, 0, 23, 59, 59, 999);
      const pName = `M${String(month).padStart(2, '0')}-${pStart.toLocaleString('default', { month: 'short', year: 'numeric' })}`;
      await this.repository.insertPeriod({
        id: randomUUID(), fiscalYearId: fy.id, periodNumber: month, name: pName,
        startDate: pStart.toISOString(), endDate: pEnd.toISOString(),
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
  async getEntries(): Promise<JournalEntryRecord[]> { return this.repository.listEntries(); }
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

    // Auto-resolve Fiscal Year and Period if not provided
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
      id: randomUUID(), entryNumber, ...input,
      fiscalYearId: fyId, periodId: pId,
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
      accountId, accountCode: v.code, accountName: v.name,
      totalDebit: v.debit.toFixed(4), totalCredit: v.credit.toFixed(4), balance: (v.debit - v.credit).toFixed(4),
    }));
  }
}