import { FinanceService } from './finance.service';
import { FinanceRepository } from './finance.repository';
import { SalesService } from '../sales/sales.service';
import { AccountingService } from '../accounting/accounting.service';
import { AccountingRepository } from '../accounting/accounting.repository';
import { FinanceValidationError } from './finance.errors';
import type {
  BankTransferRecord,
  CreateBankTransferInput,
  BankReconciliationRecord,
  CreateBankReconciliationInput,
} from './finance.types';

describe('FinanceService — Bank Transfers & Bank Reconciliation Engine', () => {
  let financeService: FinanceService;
  let financeRepo: FinanceRepository;
  let salesService: SalesService;
  let accountingService: AccountingService;
  let accountingRepo: AccountingRepository;

  const mockOrgNodeId = 'org-medical-factory-1';
  const mockFromBankAccountId = 'acc-bank-cib-source';
  const mockToCashTreasuryAccountId = 'acc-cash-treasury-dest';

  // Mock In-Memory State
  const mockTransfers: Map<string, BankTransferRecord> = new Map();
  const mockReconciliations: Map<string, BankReconciliationRecord> = new Map();
  const mockPostedJournals: any[] = [];

  beforeEach(() => {
    mockTransfers.clear();
    mockReconciliations.clear();
    mockPostedJournals.length = 0;

    financeRepo = {
      countBankTransfers: jest.fn().mockImplementation(async () => mockTransfers.size),
      insertBankTransfer: jest.fn().mockImplementation(async (input) => {
        const record: BankTransferRecord = {
          id: input.id,
          transferNumber: input.transferNumber,
          orgNodeId: input.orgNodeId,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          transferDate: input.transferDate ?? new Date().toISOString(),
          amount: input.amount,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockTransfers.set(input.id, record);
        return record;
      }),
      findBankTransferById: jest.fn().mockImplementation(async (id: string) => {
        return mockTransfers.get(id) ?? null;
      }),
      setBankTransferStatus: jest.fn().mockImplementation(async (id: string, status: any) => {
        const t = mockTransfers.get(id);
        if (t) {
          t.status = status;
          t.updatedAt = new Date().toISOString();
        }
        return t;
      }),

      countBankReconciliations: jest.fn().mockImplementation(async () => mockReconciliations.size),
      insertBankReconciliation: jest.fn().mockImplementation(async (input) => {
        const record: BankReconciliationRecord = {
          id: input.id,
          reconciliationNumber: input.reconciliationNumber,
          orgNodeId: input.orgNodeId,
          bankAccountId: input.bankAccountId,
          statementDate: input.statementDate,
          statementBalance: input.statementBalance,
          clearedBalance: input.clearedBalance,
          differenceAmount: input.differenceAmount,
          status: 'reconciled',
          notes: input.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockReconciliations.set(input.id, record);
        return record;
      }),
    } as unknown as FinanceRepository;

    salesService = {} as unknown as SalesService;

    accountingRepo = {
      listAllPostedLinesWithDetails: jest.fn().mockImplementation(async () => [
        // GL lines for CIB Bank: Debits (150,000 EGP) - Credits (5,000 EGP) = Net Book Balance (145,000 EGP)
        {
          accountId: mockFromBankAccountId,
          debit: '150000.0000',
          credit: '5000.0000',
          entryDate: new Date('2026-09-20'),
        },
      ]),
    } as unknown as AccountingRepository;

    accountingService = {
      createEntry: jest.fn().mockImplementation(async (input) => {
        const je = {
          id: `je-transfer-${mockPostedJournals.length + 1}`,
          entryNumber: `JE-TRX-00${mockPostedJournals.length + 1}`,
          orgNodeId: input.orgNodeId,
          description: input.description,
          entryDate: input.entryDate,
          status: 'draft',
          lines: input.lines,
        };
        return je;
      }),
      postEntry: jest.fn().mockImplementation(async (id: string) => {
        const je = { id, status: 'posted' };
        mockPostedJournals.push(je);
        return je;
      }),
    } as unknown as AccountingService;

    financeService = new FinanceService(
      financeRepo,
      salesService,
      accountingService,
      accountingRepo,
    );
  });

  it('1. Internal Bank Transfer: should create and post [Dr Destination Cash / Cr Source Bank]', async () => {
    const input: CreateBankTransferInput = {
      orgNodeId: mockOrgNodeId,
      fromAccountId: mockFromBankAccountId,
      toAccountId: mockToCashTreasuryAccountId,
      amount: '50000.0000',
      transferDate: '2026-09-21',
      referenceNumber: 'CHQ-CIB-100200',
      notes: 'سحب نقدي من CIB لتغذية الخزينة الرئيسية',
    };

    const transfer = await financeService.createBankTransfer(input);

    expect(transfer.transferNumber).toBe('BTR-2026-000001');
    expect(transfer.amount).toBe('50000.0000');
    expect(transfer.status).toBe('draft');

    // Post Transfer
    const postedTransfer = await financeService.postBankTransfer(transfer.id);
    expect(postedTransfer.status).toBe('posted');

    // Verify GL Posting: [Dr Destination Treasury (50,000) / Cr Source Bank (50,000)]
    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orgNodeId: mockOrgNodeId,
        isAutoGenerated: true,
        sourceEventType: 'bank_transfer',
        lines: expect.arrayContaining([
          // Dr: Destination Cash Treasury
          expect.objectContaining({
            accountId: mockToCashTreasuryAccountId,
            debitAmount: '50000.0000',
            creditAmount: '0',
          }),
          // Cr: Source CIB Bank
          expect.objectContaining({
            accountId: mockFromBankAccountId,
            debitAmount: '0',
            creditAmount: '50000.0000',
          }),
        ]),
      }),
    );
    expect(accountingService.postEntry).toHaveBeenCalledTimes(1);
  });

  it('2. Bank Statement Reconciliation: should calculate difference between statement and GL book balance', async () => {
    // Statement Balance from Bank = 150,000 EGP
    // Cleared GL Book Balance = 145,000 EGP (Difference = +5,000 EGP)
    const input: CreateBankReconciliationInput = {
      orgNodeId: mockOrgNodeId,
      bankAccountId: mockFromBankAccountId,
      statementDate: '2026-09-30',
      statementBalance: '150000.0000',
      notes: 'تسوية كشف حساب بنك CIB لشهر سبتمبر',
    };

    const recon = await financeService.createBankReconciliation(input);

    expect(recon.reconciliationNumber).toBe('BREC-2026-000001');
    expect(recon.statementBalance).toBe('150000.0000');
    expect(recon.clearedBalance).toBe('145000.0000');
    expect(recon.differenceAmount).toBe('5000.0000');
    expect(recon.status).toBe('reconciled');
  });

  it('3. Validation: should reject transfer between identical accounts or non-positive amounts', async () => {
    // Same source and destination
    await expect(
      financeService.createBankTransfer({
        orgNodeId: mockOrgNodeId,
        fromAccountId: mockFromBankAccountId,
        toAccountId: mockFromBankAccountId,
        amount: '1000',
      }),
    ).rejects.toThrow(FinanceValidationError);

    // Non-positive amount
    await expect(
      financeService.createBankTransfer({
        orgNodeId: mockOrgNodeId,
        fromAccountId: mockFromBankAccountId,
        toAccountId: mockToCashTreasuryAccountId,
        amount: '0',
      }),
    ).rejects.toThrow(FinanceValidationError);
  });

  it('4. Security & State: should prevent re-posting or cancelling an already posted bank transfer', async () => {
    const transfer = await financeService.createBankTransfer({
      orgNodeId: mockOrgNodeId,
      fromAccountId: mockFromBankAccountId,
      toAccountId: mockToCashTreasuryAccountId,
      amount: '1000.0000',
    });

    await financeService.postBankTransfer(transfer.id);

    // Try re-posting
    await expect(financeService.postBankTransfer(transfer.id)).rejects.toThrow(
      FinanceValidationError,
    );

    // Try cancelling
    await expect(financeService.cancelBankTransfer(transfer.id)).rejects.toThrow(
      FinanceValidationError,
    );
  });
});
