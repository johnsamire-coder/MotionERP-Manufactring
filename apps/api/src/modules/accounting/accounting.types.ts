export type NormalBalance = 'debit' | 'credit';
export type ChartAccountStatus = 'active' | 'inactive';
export type JournalEntryStatus = 'draft' | 'posted' | 'cancelled';

export interface AccountTypeRecord { id: string; code: string; name: string; normalBalance: NormalBalance; }
export interface CreateAccountTypeInput { code: string; name: string; normalBalance: NormalBalance; }

export interface ChartOfAccountsRecord {
  id: string; code: string; name: string; accountTypeId: string; parentId: string | null;
  isLeaf: boolean; status: ChartAccountStatus;
}
export interface CreateChartOfAccountsInput {
  code: string; name: string; accountTypeId: string; parentId?: string;
}

export interface JournalLineRecord {
  id: string; journalEntryId: string; accountId: string; debitAmount: string; creditAmount: string; description: string | null;
}
export interface JournalEntryRecord {
  id: string; entryNumber: string; reference: string | null; description: string;
  entryDate: string; postedAt: string | null; status: JournalEntryStatus; lines: JournalLineRecord[];
}
export interface CreateJournalLineInput { accountId: string; debitAmount?: string; creditAmount?: string; description?: string; }
export interface CreateJournalEntryInput {
  description: string; reference?: string; entryDate?: string; lines: CreateJournalLineInput[];
}

export interface AccountBalance { accountId: string; accountCode: string; accountName: string; totalDebit: string; totalCredit: string; balance: string; }
