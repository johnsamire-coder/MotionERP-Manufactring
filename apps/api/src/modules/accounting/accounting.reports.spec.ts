import { AccountingService } from './accounting.service';
import { AccountingRepository } from './accounting.repository';

describe('AccountingService — Financial Reports Engine (Trial Balance, P&L, Balance Sheet, Partner Ledger)', () => {
  let accountingService: AccountingService;
  let accountingRepo: AccountingRepository;

  const mockOrgNodeId = 'org-company-1';

  beforeEach(() => {
    accountingRepo = {
      listEntryIdsBySourceForCompany: jest.fn().mockResolvedValue([]),
      listAllPostedLinesWithDetails: jest.fn().mockImplementation(async () => [
        // --- Assets (Debits) ---
        {
          accountId: 'acc-bank',
          code: '1101',
          name: 'حساب البنك الأهلي المصري',
          typeCode: 'asset',
          normalBalance: 'debit',
          debit: '50000.0000',
          credit: '10000.0000', // Net Asset = 40,000 EGP
          entryDate: new Date('2026-09-15'),
          partyType: null,
          partyId: null,
          journalEntryId: 'je-1',
          entryNumber: 'JE-001',
          description: 'إيداعات ومسحوبات بنكية',
        },
        {
          accountId: 'acc-inv',
          code: '1201',
          name: 'مخزن المواد الخام',
          typeCode: 'asset',
          normalBalance: 'debit',
          debit: '30000.0000',
          credit: '10000.0000', // Net Asset = 20,000 EGP
          entryDate: new Date('2026-09-16'),
          partyType: null,
          partyId: null,
          journalEntryId: 'je-2',
          entryNumber: 'JE-002',
          description: 'حركات مخزنية',
        },
        {
          accountId: 'acc-ar',
          code: '1301',
          name: 'العملاء - ذمم مدينة',
          typeCode: 'asset',
          normalBalance: 'debit',
          debit: '25000.0000',
          credit: '5000.0000', // Net Asset = 20,000 EGP
          entryDate: new Date('2026-09-17'),
          partyType: 'customer',
          partyId: 'cust-1',
          journalEntryId: 'je-3',
          entryNumber: 'JE-003',
          description: 'مبيعات وتحصيلات عملاء',
        },

        // --- Liabilities & Equity (Credits) ---
        {
          accountId: 'acc-ap',
          code: '2101',
          name: 'الموردون - ذمم دائنة',
          typeCode: 'liability',
          normalBalance: 'credit',
          debit: '5000.0000',
          credit: '25000.0000', // Net Liability = 20,000 EGP
          entryDate: new Date('2026-09-18'),
          partyType: 'supplier',
          partyId: 'sup-1',
          journalEntryId: 'je-4',
          entryNumber: 'JE-004',
          description: 'مشتريات وسداد موردين',
        },
        {
          accountId: 'acc-capital',
          code: '3101',
          name: 'رأس المال المدفوع',
          typeCode: 'equity',
          normalBalance: 'credit',
          debit: '0.0000',
          credit: '30000.0000', // Net Equity = 30,000 EGP
          entryDate: new Date('2026-09-01'),
          partyType: null,
          partyId: null,
          journalEntryId: 'je-5',
          entryNumber: 'JE-005',
          description: 'رأس المال الافتتاحي',
        },

        // --- P&L: Revenue, COGS, Expenses ---
        {
          accountId: 'acc-rev',
          code: '4101',
          name: 'إيرادات المبيعات',
          typeCode: 'revenue',
          normalBalance: 'credit',
          debit: '0.0000',
          credit: '50000.0000', // Net Revenue = 50,000 EGP
          entryDate: new Date('2026-09-19'),
          partyType: null,
          partyId: null,
          journalEntryId: 'je-6',
          entryNumber: 'JE-006',
          description: 'مبيعات منتجات تامة',
        },
        {
          accountId: 'acc-cogs',
          code: '5101',
          name: 'تكلفة البضاعة المباعة COGS',
          typeCode: 'cogs',
          normalBalance: 'debit',
          debit: '15000.0000',
          credit: '0.0000', // Net COGS = 15,000 EGP
          entryDate: new Date('2026-09-20'),
          partyType: null,
          partyId: null,
          journalEntryId: 'je-7',
          entryNumber: 'JE-007',
          description: 'تكلفة تسليمات المبيعات',
        },
        {
          accountId: 'acc-exp',
          code: '6101',
          name: 'مصروفات كهرباء وتشغيل المصنع',
          typeCode: 'expense',
          normalBalance: 'debit',
          debit: '5000.0000',
          credit: '0.0000', // Net Expense = 5,000 EGP
          entryDate: new Date('2026-09-21'),
          partyType: null,
          partyId: null,
          journalEntryId: 'je-8',
          entryNumber: 'JE-008',
          description: 'كهرباء وإنارة الورشة',
        },
      ]),

      getPartnerLedgerLines: jest.fn().mockImplementation(async (partyType: string, partyId: string) => [
        {
          id: 'line-1',
          debitAmount: '11400.0000',
          creditAmount: '0.0000',
          description: 'فاتورة مبيعات رقم SINV-2026-000001',
          entryDate: new Date('2026-09-10'),
          journalEntryId: 'je-10',
          entryNumber: 'JE-2026-0010',
        },
        {
          id: 'line-2',
          debitAmount: '0.0000',
          creditAmount: '5000.0000',
          description: 'سند تحصيل نقدي رقم COL-2026-000001',
          entryDate: new Date('2026-09-15'),
          journalEntryId: 'je-11',
          entryNumber: 'JE-2026-0011',
        },
      ]),
    } as unknown as AccountingRepository;

    accountingService = new AccountingService(accountingRepo);
  });

  it('1. Trial Balance: should calculate total debits and credits and verify balanced status', async () => {
    const tb = await accountingService.getTrialBalance(mockOrgNodeId);

    expect(tb.isBalanced).toBe(true);
    expect(Number(tb.totalDebit)).toBe(Number(tb.totalCredit));
    expect(tb.rows.length).toBe(8);

    const bankRow = tb.rows.find((r) => r.accountCode === '1101');
    expect(bankRow?.debit).toBe('50000.0000');
    expect(bankRow?.credit).toBe('10000.0000');
    expect(bankRow?.balance).toBe('40000.0000');
  });

  it('2. Profit & Loss: should compute Gross Profit and Net Profit accurately', async () => {
    const pnl = await accountingService.getProfitAndLoss(mockOrgNodeId);

    // Revenue = 50,000 | COGS = 15,000 -> Gross Profit = 35,000 EGP
    expect(pnl.totalRevenue).toBe('50000.0000');
    expect(pnl.totalCogs).toBe('15000.0000');
    expect(pnl.grossProfit).toBe('35000.0000');

    // Expenses = 5,000 -> Net Profit = 30,000 EGP
    expect(pnl.totalExpenses).toBe('5000.0000');
    expect(pnl.netProfit).toBe('30000.0000');
  });

  it('3. Balance Sheet: Assets must equal Liabilities + Equity (including current net profit)', async () => {
    const bs = await accountingService.getBalanceSheet(mockOrgNodeId, '2026-09-30');

    // Assets: Bank (40k) + Inventory (20k) + AR (20k) = 80,000 EGP
    expect(bs.totalAssets).toBe('80000.0000');

    // Liabilities: AP (20k)
    expect(bs.totalLiabilities).toBe('20000.0000');

    // Equity: Capital (30k) + Net Profit (30k) = 60,000 EGP
    expect(bs.totalEquity).toBe('60000.0000');

    // Total L&E = 20k + 60k = 80,000 EGP (Balanced!)
    expect(bs.totalLiabilitiesAndEquity).toBe('80000.0000');
    expect(bs.isBalanced).toBe(true);
  });

  it('4. Customer Partner Ledger: should track invoice, payment and calculate running balance', async () => {
    const ledger = await accountingService.getPartnerLedger('customer', 'cust-1');

    expect(ledger.rows.length).toBe(2);
    expect(ledger.totalDebit).toBe('11400.0000');
    expect(ledger.totalCredit).toBe('5000.0000');
    // Running balance: 11,400 - 5,000 = 6,400 EGP remaining balance on customer
    expect(ledger.closingBalance).toBe('6400.0000');
    expect(ledger.rows[0]?.runningBalance).toBe('11400.0000');
    expect(ledger.rows[1]?.runningBalance).toBe('6400.0000');
  });
});