import { FinanceService } from './finance.service';
import { FinanceRepository } from './finance.repository';
import { SalesService } from '../sales/sales.service';
import { AccountingService } from '../accounting/accounting.service';
import { AccountingRepository } from '../accounting/accounting.repository';
import { FinanceValidationError } from './finance.errors';
import type { PaymentRecord, CreatePaymentInput, CollectionRecord } from './finance.types';
import type {
  CompanyAccountingConfigRecord,
  AccountDeterminationRecord,
  JournalEntryRecord,
} from '../accounting/accounting.types';
import type { JobOrderRecord } from '../sales/sales.types';

describe('FinanceService — Payments, Collections & Bank GL Posting', () => {
  let financeService: FinanceService;
  let financeRepo: FinanceRepository;
  let salesService: SalesService;
  let accountingService: AccountingService;
  let accountingRepo: AccountingRepository;

  // Mock In-Memory State
  const mockPayments: Map<string, PaymentRecord> = new Map();
  const mockCollections: Map<string, CollectionRecord> = new Map();
  const mockPostedJournals: JournalEntryRecord[] = [];

  const mockOrgNodeId = 'org-company-1';
  const mockSupplierId = 'sup-steel-vendor-1';
  const mockCustomerId = 'cust-medical-hospital-1';
  const mockBankAccountId = 'acc-bank-cib-egp';
  const mockApAccountId = 'acc-accounts-payable';
  const mockArAccountId = 'acc-accounts-receivable';

  beforeEach(() => {
    mockPayments.clear();
    mockCollections.clear();
    mockPostedJournals.length = 0;

    financeRepo = {
      countPayments: jest.fn().mockImplementation(async () => mockPayments.size),
      insertPayment: jest.fn().mockImplementation(async (input) => {
        const record: PaymentRecord = {
          id: input.id,
          paymentNumber: input.paymentNumber,
          orgNodeId: input.orgNodeId,
          supplierId: input.supplierId ?? null,
          purchaseInvoiceId: input.purchaseInvoiceId ?? null,
          paymentDate: input.paymentDate ?? new Date().toISOString(),
          amount: input.amount,
          currencyCode: input.currencyCode ?? 'EGP',
          paymentMethod: input.paymentMethod,
          paidFromAccountId: input.paidFromAccountId,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockPayments.set(input.id, record);
        return record;
      }),
      findPaymentById: jest.fn().mockImplementation(async (id: string) => {
        return mockPayments.get(id) ?? null;
      }),
      setPaymentStatus: jest.fn().mockImplementation(async (id: string, status: any) => {
        const p = mockPayments.get(id);
        if (p) {
          p.status = status;
          p.updatedAt = new Date().toISOString();
        }
        return p;
      }),
      listPayments: jest.fn().mockImplementation(async () => Array.from(mockPayments.values())),

      countCollections: jest.fn().mockImplementation(async () => mockCollections.size),
      insertCollection: jest.fn().mockImplementation(async (input) => {
        const record: CollectionRecord = {
          id: input.id,
          jobOrderReference: input.jobOrderReference,
          orgNodeId: input.orgNodeId,
          collectionNumber: input.collectionNumber,
          collectionDate: input.collectionDate ?? new Date().toISOString(),
          amount: input.amount,
          currencyCode: input.currencyCode ?? 'EGP',
          paymentMethod: input.paymentMethod,
          receivedInAccountId: input.receivedInAccountId ?? null,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          status: 'completed',
        };
        mockCollections.set(input.id, record);
        return record;
      }),
      listCollections: jest
        .fn()
        .mockImplementation(async () => Array.from(mockCollections.values())),
    } as unknown as FinanceRepository;

    salesService = {
      getJobOrders: jest.fn().mockResolvedValue([
        {
          id: 'jo-1',
          jobOrderNumber: 'JO-2026-000001',
          orgNodeId: mockOrgNodeId,
          customerId: mockCustomerId,
        } as JobOrderRecord,
      ]),
    } as unknown as SalesService;

    accountingRepo = {
      findCompanyConfig: jest.fn().mockResolvedValue({
        orgNodeId: mockOrgNodeId,
        defaultPayableAccountId: mockApAccountId,
        defaultReceivableAccountId: mockArAccountId,
      } as CompanyAccountingConfigRecord),
      listAccountDeterminations: jest.fn().mockResolvedValue([
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'payable',
          accountId: mockApAccountId,
        } as AccountDeterminationRecord,
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'receivable',
          accountId: mockArAccountId,
        } as AccountDeterminationRecord,
      ]),
    } as unknown as AccountingRepository;

    accountingService = {
      createEntry: jest.fn().mockImplementation(async (input) => {
        const je: JournalEntryRecord = {
          id: `je-${mockPostedJournals.length + 1}`,
          entryNumber: `JE-2026-00000${mockPostedJournals.length + 1}`,
          orgNodeId: input.orgNodeId,
          reference: input.reference ?? null,
          description: input.description,
          entryDate: input.entryDate ?? new Date().toISOString(),
          postedAt: null,
          status: 'draft',
          fiscalYearId: null,
          periodId: null,
          isAutoGenerated: true,
          idempotencyKey: input.idempotencyKey ?? null,
          sourceEventType: input.sourceEventType ?? null,
          lines: input.lines.map((l: any, idx: number) => ({
            id: `jl-${idx + 1}`,
            journalEntryId: `je-${mockPostedJournals.length + 1}`,
            accountId: l.accountId,
            debitAmount: l.debitAmount ?? '0',
            creditAmount: l.creditAmount ?? '0',
            description: l.description ?? null,
            partyType: l.partyType ?? null,
            partyId: l.partyId ?? null,
          })),
        };
        return je;
      }),
      postEntry: jest.fn().mockImplementation(async (id: string) => {
        const je: JournalEntryRecord = {
          id,
          entryNumber: 'JE-2026-000001',
          orgNodeId: mockOrgNodeId,
          reference: 'PAY-2026-000001',
          description: 'Posted',
          entryDate: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          status: 'posted',
          lines: [],
        };
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

  it('1. Supplier Payment: should create and post [Dr AP (Supplier Subledger) / Cr Bank Account]', async () => {
    const input: CreatePaymentInput = {
      orgNodeId: mockOrgNodeId,
      supplierId: mockSupplierId,
      amount: '5000.0000',
      paymentMethod: 'bank_transfer',
      paidFromAccountId: mockBankAccountId,
      referenceNumber: 'TRX-BANK-998811',
    };

    const payment = await financeService.createPayment(input);

    expect(payment.paymentNumber).toBe('PAY-2026-000001');
    expect(payment.amount).toBe('5000.0000');
    expect(payment.status).toBe('draft');

    // Post the payment
    const postedPayment = await financeService.postPayment(payment.id);

    expect(postedPayment.status).toBe('posted');
    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orgNodeId: mockOrgNodeId,
        isAutoGenerated: true,
        idempotencyKey: `payment-${payment.id}`,
        lines: expect.arrayContaining([
          // Dr AP (5000 with supplier partyId)
          expect.objectContaining({
            accountId: mockApAccountId,
            debitAmount: '5000.0000',
            creditAmount: '0',
            partyType: 'supplier',
            partyId: mockSupplierId,
          }),
          // Cr Bank Account (5000)
          expect.objectContaining({
            accountId: mockBankAccountId,
            debitAmount: '0',
            creditAmount: '5000.0000',
          }),
        ]),
      }),
    );
    expect(accountingService.postEntry).toHaveBeenCalledTimes(1);
  });

  it('2. Customer Collection: should record collection and automatically post [Dr Bank / Cr AR (Customer Subledger)]', async () => {
    const collection = await financeService.recordCollection({
      jobOrderReference: 'JO-2026-000001',
      amount: '11400.0000',
      paymentMethod: 'bank_transfer',
      receivedInAccountId: mockBankAccountId,
      referenceNumber: 'CUST-DEP-7744',
    });

    expect(collection.collectionNumber).toBe('COL-2026-000001');
    expect(collection.amount).toBe('11400.0000');

    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orgNodeId: mockOrgNodeId,
        isAutoGenerated: true,
        idempotencyKey: `collection-${collection.id}`,
        lines: expect.arrayContaining([
          // Dr Bank Account (11400)
          expect.objectContaining({
            accountId: mockBankAccountId,
            debitAmount: '11400.0000',
            creditAmount: '0',
          }),
          // Cr AR (11400 with customer partyId)
          expect.objectContaining({
            accountId: mockArAccountId,
            debitAmount: '0',
            creditAmount: '11400.0000',
            partyType: 'customer',
            partyId: mockCustomerId,
          }),
        ]),
      }),
    );
    expect(accountingService.postEntry).toHaveBeenCalledTimes(1);
  });

  it('3. Validation: should reject payment with missing bank account or non-positive amount', async () => {
    await expect(
      financeService.createPayment({
        orgNodeId: mockOrgNodeId,
        amount: '0',
        paymentMethod: 'cash',
        paidFromAccountId: mockBankAccountId,
      }),
    ).rejects.toThrow(FinanceValidationError);

    await expect(
      financeService.createPayment({
        orgNodeId: mockOrgNodeId,
        amount: '1000',
        paymentMethod: 'cash',
        paidFromAccountId: '',
      }),
    ).rejects.toThrow(FinanceValidationError);
  });

  it('4. Security & State: should prevent re-posting or cancelling an already posted payment', async () => {
    const payment = await financeService.createPayment({
      orgNodeId: mockOrgNodeId,
      supplierId: mockSupplierId,
      amount: '1000.0000',
      paymentMethod: 'cash',
      paidFromAccountId: mockBankAccountId,
    });

    await financeService.postPayment(payment.id);

    // Try re-posting
    await expect(financeService.postPayment(payment.id)).rejects.toThrow(FinanceValidationError);

    // Try cancelling
    await expect(financeService.cancelPayment(payment.id)).rejects.toThrow(FinanceValidationError);
  });
});
