import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { accountType, chartOfAccounts, journalEntry, journalLine } from './accounting.schema';
import type {
  AccountTypeRecord, ChartAccountStatus, ChartOfAccountsRecord, CreateAccountTypeInput,
  CreateChartOfAccountsInput, CreateJournalEntryInput, JournalEntryRecord, JournalEntryStatus,
  JournalLineRecord, NormalBalance,
} from './accounting.types';

const atColumns = { id: accountType.id, code: accountType.code, name: accountType.name, normalBalance: accountType.normalBalance };
const coaColumns = {
  id: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name,
  accountTypeId: chartOfAccounts.accountTypeId, parentId: chartOfAccounts.parentId,
  isLeaf: chartOfAccounts.isLeaf, status: chartOfAccounts.status,
};
const jeColumns = {
  id: journalEntry.id, entryNumber: journalEntry.entryNumber, reference: journalEntry.reference,
  description: journalEntry.description, entryDate: journalEntry.entryDate, postedAt: journalEntry.postedAt, status: journalEntry.status,
};
const jlColumns = {
  id: journalLine.id, journalEntryId: journalLine.journalEntryId, accountId: journalLine.accountId,
  debitAmount: journalLine.debitAmount, creditAmount: journalLine.creditAmount, description: journalLine.description,
};

interface AtRow { id: string; code: string; name: string; normalBalance: string; }
interface CoaRow { id: string; code: string; name: string; accountTypeId: string; parentId: string | null; isLeaf: string; status: string; }
interface JeRow { id: string; entryNumber: string; reference: string | null; description: string; entryDate: Date; postedAt: Date | null; status: string; }
interface JlRow { id: string; journalEntryId: string; accountId: string; debitAmount: string; creditAmount: string; description: string | null; }

function toAtRecord(row: AtRow): AccountTypeRecord { return { id: row.id, code: row.code, name: row.name, normalBalance: row.normalBalance as NormalBalance }; }
function toCoaRecord(row: CoaRow): ChartOfAccountsRecord {
  return { id: row.id, code: row.code, name: row.name, accountTypeId: row.accountTypeId, parentId: row.parentId,
    isLeaf: row.isLeaf === 'yes', status: row.status as ChartAccountStatus };
}
function toJlRecord(row: JlRow): JournalLineRecord {
  return { id: row.id, journalEntryId: row.journalEntryId, accountId: row.accountId, debitAmount: row.debitAmount, creditAmount: row.creditAmount, description: row.description };
}
function toJeRecord(row: JeRow, lines: JournalLineRecord[]): JournalEntryRecord {
  return { id: row.id, entryNumber: row.entryNumber, reference: row.reference, description: row.description,
    entryDate: row.entryDate.toISOString(), postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    status: row.status as JournalEntryStatus, lines };
}

@Injectable()
export class AccountingRepository {
  constructor(private readonly database: DatabaseService) {}

  async listAccountTypes(): Promise<AccountTypeRecord[]> {
    const rows = await this.database.db.select(atColumns).from(accountType).orderBy(asc(accountType.code));
    return rows.map(toAtRecord);
  }
  async findAccountTypeByCode(code: string): Promise<AccountTypeRecord | null> {
    const rows = await this.database.db.select(atColumns).from(accountType).where(eq(accountType.code, code)).limit(1);
    return rows[0] ? toAtRecord(rows[0]) : null;
  }
  async findAccountTypeById(id: string): Promise<AccountTypeRecord | null> {
    const rows = await this.database.db.select(atColumns).from(accountType).where(eq(accountType.id, id)).limit(1);
    return rows[0] ? toAtRecord(rows[0]) : null;
  }
  async insertAccountType(input: CreateAccountTypeInput & { id: string }): Promise<AccountTypeRecord> {
    const rows = await this.database.db.insert(accountType).values(input).returning(atColumns);
    return toAtRecord(rows[0]!);
  }

  async listAccounts(): Promise<ChartOfAccountsRecord[]> {
    const rows = await this.database.db.select(coaColumns).from(chartOfAccounts).orderBy(asc(chartOfAccounts.code));
    return rows.map(toCoaRecord);
  }
  async findAccountById(id: string): Promise<ChartOfAccountsRecord | null> {
    const rows = await this.database.db.select(coaColumns).from(chartOfAccounts).where(eq(chartOfAccounts.id, id)).limit(1);
    return rows[0] ? toCoaRecord(rows[0]) : null;
  }
  async findAccountByCode(code: string): Promise<ChartOfAccountsRecord | null> {
    const rows = await this.database.db.select(coaColumns).from(chartOfAccounts).where(eq(chartOfAccounts.code, code)).limit(1);
    return rows[0] ? toCoaRecord(rows[0]) : null;
  }
  async insertAccount(input: CreateChartOfAccountsInput & { id: string }): Promise<ChartOfAccountsRecord> {
    const rows = await this.database.db.insert(chartOfAccounts).values({
      id: input.id, code: input.code, name: input.name, accountTypeId: input.accountTypeId, parentId: input.parentId ?? null,
    }).returning(coaColumns);
    return toCoaRecord(rows[0]!);
  }
  async markAsParent(id: string): Promise<void> {
    await this.database.db.update(chartOfAccounts).set({ isLeaf: 'no' }).where(eq(chartOfAccounts.id, id));
  }

  async listEntries(): Promise<JournalEntryRecord[]> {
    const entries = await this.database.db.select(jeColumns).from(journalEntry).orderBy(asc(journalEntry.entryNumber));
    const allLines = await this.database.db.select(jlColumns).from(journalLine);
    return entries.map((e) => toJeRecord(e, allLines.filter((l) => l.journalEntryId === e.id).map(toJlRecord)));
  }
  async findEntryById(id: string): Promise<JournalEntryRecord | null> {
    const rows = await this.database.db.select(jeColumns).from(journalEntry).where(eq(journalEntry.id, id)).limit(1);
    if (!rows[0]) return null;
    const lines = await this.database.db.select(jlColumns).from(journalLine).where(eq(journalLine.journalEntryId, id));
    return toJeRecord(rows[0], lines.map(toJlRecord));
  }
  async countEntries(): Promise<number> {
    const rows = await this.database.db.select({ id: journalEntry.id }).from(journalEntry);
    return rows.length;
  }
  async insertEntry(input: CreateJournalEntryInput & { id: string; entryNumber: string }): Promise<JournalEntryRecord> {
    const rows = await this.database.db.insert(journalEntry).values({
      id: input.id, entryNumber: input.entryNumber, reference: input.reference ?? null,
      description: input.description, entryDate: input.entryDate ? new Date(input.entryDate) : new Date(),
    }).returning(jeColumns);
    const inserted = rows[0]!;
    const lines: JournalLineRecord[] = [];
    for (const line of input.lines) {
      const lineRows = await this.database.db.insert(journalLine).values({
        journalEntryId: inserted.id, accountId: line.accountId,
        debitAmount: line.debitAmount ?? '0', creditAmount: line.creditAmount ?? '0', description: line.description,
      }).returning(jlColumns);
      lines.push(toJlRecord(lineRows[0]!));
    }
    return toJeRecord(inserted, lines);
  }
  async setEntryStatus(id: string, status: JournalEntryStatus): Promise<JournalEntryRecord> {
    const fields: { status: JournalEntryStatus; postedAt?: Date } = { status };
    if (status === 'posted') fields.postedAt = new Date();
    const rows = await this.database.db.update(journalEntry).set(fields).where(eq(journalEntry.id, id)).returning(jeColumns);
    const lines = await this.database.db.select(jlColumns).from(journalLine).where(eq(journalLine.journalEntryId, id));
    return toJeRecord(rows[0]!, lines.map(toJlRecord));
  }

  async listAllPostedLinesWithAccounts(): Promise<Array<{ accountId: string; code: string; name: string; debit: string; credit: string }>> {
    const rows = await this.database.db.select({
      accountId: chartOfAccounts.id, code: chartOfAccounts.code, name: chartOfAccounts.name,
      debit: journalLine.debitAmount, credit: journalLine.creditAmount, entryStatus: journalEntry.status,
    }).from(journalLine)
      .innerJoin(chartOfAccounts, eq(journalLine.accountId, chartOfAccounts.id))
      .innerJoin(journalEntry, eq(journalLine.journalEntryId, journalEntry.id));
    return rows.filter((r) => r.entryStatus === 'posted').map(({ accountId, code, name, debit, credit }) => ({ accountId, code, name, debit, credit }));
  }
}
