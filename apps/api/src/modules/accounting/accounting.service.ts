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

  async createAccount(input: CreateChartOfAccountsInput): Promise<ChartOfAccountsRecord> {
    const code = input.code.trim();
    if (!code) throw new AccountingValidationError('code is required');
    const existing = await this.repository.findAccountByCode(code);
    if (existing) throw new AccountingValidationError(`an account with code "${code}" already exists`);

    const accountType = await this.repository.findAccountTypeById(input.accountTypeId);
    if (!accountType) throw new AccountingNotFoundError(`account type ${input.accountTypeId} does not exist`);

    if (input.parentId) {
      const parent = await this.repository.findAccountById(input.parentId);
      if (!parent) throw new AccountingNotFoundError(`parent account ${input.parentId} does not exist`);
      // Parent accounts become non-leaf once they get a child (they cannot receive direct journal lines afterward — enforced in createEntry).
      await this.repository.markAsParent(input.parentId);
    }

    return this.repository.insertAccount({ id: randomUUID(), code, name: input.name.trim(), accountTypeId: input.accountTypeId, parentId: input.parentId });
  }

  async getEntries(): Promise<JournalEntryRecord[]> { return this.repository.listEntries(); }

  async getEntry(id: string): Promise<JournalEntryRecord> {
    const found = await this.repository.findEntryById(id);
    if (!found) throw new AccountingNotFoundError(`journal entry ${id} does not exist`);
    return found;
  }

  /**
   * Creates a journal entry in 'draft' status. Validates every line refers to
   * a real, LEAF account (D35-style rule: postings only touch leaf accounts,
   * never a parent/summary account) and that no line has both debit and
   * credit or neither.
   */
  async createEntry(input: CreateJournalEntryInput): Promise<JournalEntryRecord> {
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
    }

    const sequence = (await this.repository.countEntries()) + 1;
    const year = new Date().getFullYear();
    const entryNumber = `JE-${year}-${String(sequence).padStart(6, '0')}`;

    return this.repository.insertEntry({ id: randomUUID(), entryNumber, ...input });
  }

  /**
   * The one rule that can never be broken: total debit must equal total
   * credit before a draft can be posted. This is checked HERE (at posting
   * time), not at creation time, so a draft can be built incrementally
   * across multiple lines before the final balance check.
   */
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

  /** Running balance per account, computed only from POSTED entries (draft/cancelled entries never affect balances). */
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
