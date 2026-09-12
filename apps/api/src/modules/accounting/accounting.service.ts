import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AccountingNotFoundError, AccountingValidationError } from './accounting.errors';
import { AccountingRepository } from './accounting.repository';
import type {
  AccountBalance, AccountTypeRecord, ChartOfAccountsRecord, CreateAccountTypeInput,
  CreateChartOfAccountsInput, CreateJournalEntryInput, JournalEntryRecord,
} from './accounting.types';

@Injectable()
export class AccountingService {
  constructor(private readonly repository: AccountingRepository) {}

  async getAccountTypes(): Promise<AccountTypeRecord[]> { return this.repository.listAccountTypes(); }

  async createAccountType(input: CreateAccountTypeInput): Promise<AccountTypeRecord> {
    const code = input.code.trim().toLowerCase();
    if (!code) throw new AccountingValidationError('code is required');
    const existing = await this.repository.findAccountTypeByCode(code);
    if (existing) throw new AccountingValidationError(`an account type with code "${code}" already exists`);
    return this.repository.insertAccountType({ id: randomUUID(), code, name: input.name.trim(), normalBalance: input.normalBalance });
  }

  async getAccounts(): Promise<ChartOfAccountsRecord[]> { return this.repository.listAccounts(); }

  /**
   * Chart of accounts is scoped per company (org_node) — orgNodeId is
   * mandatory here (D2/D20: DB-level FK to org_node, no OrganizationService
   * call needed, same pattern as inventory.warehouse). Code uniqueness is
   * checked per company, not globally, and a parent account must belong to
   * the SAME company as its child — this is a real validation gap fix, not
   * just organizational tagging: previously nothing stopped an account from
   * being parented under an account of a different company.
   */
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

  async getEntries(): Promise<JournalEntryRecord[]> { return this.repository.listEntries(); }

  async getEntry(id: string): Promise<JournalEntryRecord> {
    const found = await this.repository.findEntryById(id);
    if (!found) throw new AccountingNotFoundError(`journal entry ${id} does not exist`);
    return found;
  }

  /**
   * Creates a journal entry in 'draft' status. orgNodeId is mandatory
   * (user-supplied, like sales.quotation — not every entry traces back to a
   * job order). Every line must reference a real LEAF account belonging to
   * the SAME company as the entry — this cross-company check is new and
   * closes a real gap: previously any leaf account from any company could
   * be posted into any entry.
   */
  async createEntry(input: CreateJournalEntryInput): Promise<JournalEntryRecord> {
    if (!input.orgNodeId) throw new AccountingValidationError('orgNodeId is required');
    if (!input.lines || input.lines.length < 2) {
      throw new AccountingValidationError('a journal entry needs at least two lines (double-entry)');
    }
    if (!input.description || input.description.trim().length === 0) {
      throw new AccountingValidationError('description is required');
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
    const year = new Date().getFullYear();
    const entryNumber = `JE-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertEntry({ id: randomUUID(), entryNumber, ...input });
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
