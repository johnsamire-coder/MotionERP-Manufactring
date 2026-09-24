import { FinanceService } from './finance.service';
import { FinanceRepository } from './finance.repository';
import { SalesService } from '../sales/sales.service';
import { AccountingService } from '../accounting/accounting.service';
import { AccountingRepository } from '../accounting/accounting.repository';
import { FinanceValidationError } from './finance.errors';
import type { CreditDebitNoteRecord, CreateCreditDebitNoteInput } from './finance.types';
import type {
  CompanyAccountingConfigRecord,
  AccountDeterminationRecord,
} from '../accounting/accounting.types';

describe('FinanceService — Credit Notes, Debit Notes & Returns Accounting Engine', () => {
  let financeService: FinanceService;
  let financeRepo: FinanceRepository;
  let salesService: SalesService;
  let accountingService: AccountingService;
  let accountingRepo: AccountingRepository;

  const mockOrgNodeId = 'org-medical-factory-1';
  const mockCustomerId = 'cust-cairo-hospital';
  const mockSupplierId = 'sup-steel-egypt';

  const mockArAccountId = 'acc-accounts-receivable';
  const mockRevenueAccountId = 'acc-sales-revenue';
  const mockOutputTaxAccountId = 'acc-output-vat-14';

  const mockApAccountId = 'acc-accounts-payable';
  const mockRawInvAccountId = 'acc-raw-inventory-asset';
  const mockInputTaxAccountId = 'acc-input-vat-14';

  // Mock In-Memory State
  const mockNotes: Map<string, CreditDebitNoteRecord> = new Map();
  const mockPostedJournals: any[] = [];

  beforeEach(() => {
    mockNotes.clear();
    mockPostedJournals.length = 0;

    financeRepo = {
      countCreditDebitNotes: jest.fn().mockImplementation(async () => mockNotes.size),
      insertCreditDebitNote: jest.fn().mockImplementation(async (input) => {
        const record: CreditDebitNoteRecord = {
          id: input.id,
          noteNumber: input.noteNumber,
          noteType: input.noteType,
          orgNodeId: input.orgNodeId,
          partyType: input.partyType,
          partyId: input.partyId,
          originalInvoiceNumber: input.originalInvoiceNumber ?? null,
          salesInvoiceId: input.salesInvoiceId ?? null,
          purchaseInvoiceId: input.purchaseInvoiceId ?? null,
          postingDate: input.postingDate ?? new Date().toISOString(),
          netAmount: input.netAmount,
          taxAmount: input.taxAmount,
          grandTotal: input.grandTotal,
          reason: input.reason ?? null,
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lines: input.computedLines.map((l: any) => ({
            ...l,
            noteId: input.id,
            createdAt: new Date().toISOString(),
          })),
        };
        mockNotes.set(input.id, record);
        return record;
      }),
      findCreditDebitNoteById: jest.fn().mockImplementation(async (id: string) => {
        return mockNotes.get(id) ?? null;
      }),
      setCreditDebitNoteStatus: jest.fn().mockImplementation(async (id: string, status: any) => {
        const n = mockNotes.get(id);
        if (n) {
          n.status = status;
          n.updatedAt = new Date().toISOString();
        }
        return n;
      }),
    } as unknown as FinanceRepository;

    salesService = {} as unknown as SalesService;

    accountingRepo = {
      findCompanyConfig: jest.fn().mockResolvedValue({
        orgNodeId: mockOrgNodeId,
        defaultReceivableAccountId: mockArAccountId,
        defaultOutputTaxAccountId: mockOutputTaxAccountId,
        defaultPayableAccountId: mockApAccountId,
        defaultInputTaxAccountId: mockInputTaxAccountId,
      } as CompanyAccountingConfigRecord),
      listAccountDeterminations: jest.fn().mockResolvedValue([
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'receivable',
          accountId: mockArAccountId,
        } as AccountDeterminationRecord,
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'revenue',
          accountId: mockRevenueAccountId,
        } as AccountDeterminationRecord,
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'output_tax',
          accountId: mockOutputTaxAccountId,
        } as AccountDeterminationRecord,
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'payable',
          accountId: mockApAccountId,
        } as AccountDeterminationRecord,
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'inventory',
          accountId: mockRawInvAccountId,
        } as AccountDeterminationRecord,
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'input_tax',
          accountId: mockInputTaxAccountId,
        } as AccountDeterminationRecord,
      ]),
    } as unknown as AccountingRepository;

    accountingService = {
      createEntry: jest.fn().mockImplementation(async (input) => {
        const je = {
          id: `je-note-${mockPostedJournals.length + 1}`,
          entryNumber: `JE-NOTE-00${mockPostedJournals.length + 1}`,
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

  it('1. Customer Credit Note (Sales Return): should calculate Net, 14% VAT, and post [Dr Revenue + Dr Output VAT / Cr AR]', async () => {
    const input: CreateCreditDebitNoteInput = {
      noteType: 'credit_note',
      orgNodeId: mockOrgNodeId,
      partyType: 'customer',
      partyId: mockCustomerId,
      originalInvoiceNumber: 'SINV-2026-000001',
      reason: 'مردودات مبيعات: وحدة أدراج بها خدش بالدهان',
      lines: [
        {
          itemId: 'item-medical-cabinet-60',
          quantity: '1',
          unitPrice: '10000.0000', // Net = 10,000 | VAT (14%) = 1,400 | Total = 11,400
          taxRate: '14.00',
        },
      ],
    };

    const note = await financeService.createCreditDebitNote(input);

    expect(note.noteNumber).toBe('CRN-2026-000001');
    expect(note.netAmount).toBe('10000.0000');
    expect(note.taxAmount).toBe('1400.0000');
    expect(note.grandTotal).toBe('11400.0000');
    expect(note.status).toBe('draft');

    // Post Credit Note
    const postedNote = await financeService.postCreditDebitNote(note.id);
    expect(postedNote.status).toBe('posted');

    // Verify GL Posting: [Dr Revenue (10,000) + Dr Output VAT (1,400) / Cr AR (11,400 with customer partyId)]
    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orgNodeId: mockOrgNodeId,
        isAutoGenerated: true,
        sourceEventType: 'credit_note',
        lines: expect.arrayContaining([
          // Dr: Revenue (Reversal)
          expect.objectContaining({
            accountId: mockRevenueAccountId,
            debitAmount: '10000.0000',
            creditAmount: '0',
          }),
          // Dr: Output VAT (Reversal)
          expect.objectContaining({
            accountId: mockOutputTaxAccountId,
            debitAmount: '1400.0000',
            creditAmount: '0',
          }),
          // Cr: AR (Reduction)
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

  it('2. Supplier Debit Note (Purchase Return): should calculate Net, 14% VAT, and post [Dr AP / Cr Inventory + Cr Input VAT]', async () => {
    const input: CreateCreditDebitNoteInput = {
      noteType: 'debit_note',
      orgNodeId: mockOrgNodeId,
      partyType: 'supplier',
      partyId: mockSupplierId,
      originalInvoiceNumber: 'SUP-INV-8899',
      reason: 'مردودات مشتريات: صاج غير مطابق للمواصفات',
      lines: [
        {
          itemId: 'item-steel-sheet-60',
          quantity: '5',
          unitPrice: '1000.0000', // Net = 5,000 | VAT (14%) = 700 | Total = 5,700
          taxRate: '14.00',
        },
      ],
    };

    const note = await financeService.createCreditDebitNote(input);

    expect(note.noteNumber).toBe('DBN-2026-000001');
    expect(note.netAmount).toBe('5000.0000');
    expect(note.taxAmount).toBe('700.0000');
    expect(note.grandTotal).toBe('5700.0000');

    // Post Debit Note
    const postedNote = await financeService.postCreditDebitNote(note.id);
    expect(postedNote.status).toBe('posted');

    // Verify GL Posting: [Dr AP (5,700 with supplier partyId) / Cr Raw Inventory (5,000) + Cr Input VAT (700)]
    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orgNodeId: mockOrgNodeId,
        isAutoGenerated: true,
        sourceEventType: 'debit_note',
        lines: expect.arrayContaining([
          // Dr: AP (Reduction)
          expect.objectContaining({
            accountId: mockApAccountId,
            debitAmount: '5700.0000',
            creditAmount: '0',
            partyType: 'supplier',
            partyId: mockSupplierId,
          }),
          // Cr: Raw Inventory
          expect.objectContaining({
            accountId: mockRawInvAccountId,
            debitAmount: '0',
            creditAmount: '5000.0000',
          }),
          // Cr: Input VAT (Reversal)
          expect.objectContaining({
            accountId: mockInputTaxAccountId,
            debitAmount: '0',
            creditAmount: '700.0000',
          }),
        ]),
      }),
    );
  });

  it('3. Security & Validation: should reject note without lines and prevent re-posting or cancelling posted notes', async () => {
    await expect(
      financeService.createCreditDebitNote({
        noteType: 'credit_note',
        orgNodeId: mockOrgNodeId,
        partyType: 'customer',
        partyId: mockCustomerId,
        lines: [],
      }),
    ).rejects.toThrow(FinanceValidationError);

    const note = await financeService.createCreditDebitNote({
      noteType: 'credit_note',
      orgNodeId: mockOrgNodeId,
      partyType: 'customer',
      partyId: mockCustomerId,
      lines: [{ itemId: 'item-1', quantity: '1', unitPrice: '100' }],
    });

    await financeService.postCreditDebitNote(note.id);

    // Try re-posting
    await expect(financeService.postCreditDebitNote(note.id)).rejects.toThrow(
      FinanceValidationError,
    );

    // Try cancelling
    await expect(financeService.cancelCreditDebitNote(note.id)).rejects.toThrow(
      FinanceValidationError,
    );
  });
});
