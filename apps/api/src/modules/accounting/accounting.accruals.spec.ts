// ============================================================
// Motion ERP — Accruals, Prepaids & Provisions Unit Tests
// Step 77 | Aligned with accrual.schema.ts
// ============================================================
import { Test, TestingModule } from '@nestjs/testing';
import { AccrualsService } from './accruals.service';
import { AccrualsRepository } from './accruals.repository';
import { AccountingService } from './accounting.service';

describe('Accounting: Accruals Engine (With Custom Schema)', () => {
  let service: AccrualsService;
  let mockRepo: any;

  const mockOrgNodeId = '11111111-1111-1111-1111-111111111111';
  const mockExpenseAcc = '44444444-4444-4444-4444-444444444444';
  const mockLiabilityAcc = '55555555-5555-5555-5555-555555555555';
  const mockAssetAcc = '66666666-6666-6666-6666-666666666666';
  const mockUserId = '77777777-7777-7777-7777-777777777777';

  let dbAccruals: any[] = [];
  let dbPrepaids: any[] = [];
  let dbProvisions: any[] = [];
  const entries: Array<{ id: string; lines: any[]; description: string }> = [];
  const accounting = {
    findEntryByIdempotencyKey: jest.fn(async () => null),
    createEntry: jest.fn(async (input: any) => {
      const e = {
        id: `je-${entries.length + 1}`,
        entryNumber: `JE-${entries.length + 1}`,
        status: 'draft',
        ...input,
      };
      entries.push(e);
      return e;
    }),
    postEntry: jest.fn(async (id: string) => ({
      ...entries.find((e) => e.id === id)!,
      status: 'posted',
    })),
  };

  beforeEach(async () => {
    dbAccruals = [];
    dbPrepaids = [];
    dbProvisions = [];
    entries.length = 0;

    mockRepo = {
      createAccrual: jest.fn().mockImplementation((data) => {
        const rec = {
          id: `acc-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        dbAccruals.push(rec);
        return rec;
      }),
      findAccrualById: jest
        .fn()
        .mockImplementation((id) => dbAccruals.find((a) => a.id === id) || null),
      updateAccrualStatus: jest.fn().mockImplementation((id, status, updateObj) => {
        const item = dbAccruals.find((a) => a.id === id);
        if (item) {
          item.status = status;
          Object.assign(item, updateObj);
        }
        return item;
      }),

      createPrepaid: jest.fn().mockImplementation((data) => {
        const rec = {
          id: `pre-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        dbPrepaids.push(rec);
        return rec;
      }),
      findPrepaidById: jest
        .fn()
        .mockImplementation((id) => dbPrepaids.find((p) => p.id === id) || null),
      updatePrepaidAmortization: jest
        .fn()
        .mockImplementation((id, consumedAmount, remainingAmount, status) => {
          const item = dbPrepaids.find((p) => p.id === id);
          if (item) {
            item.consumedAmount = consumedAmount;
            item.remainingAmount = remainingAmount;
            item.status = status;
          }
          return item;
        }),

      createProvision: jest.fn().mockImplementation((data) => {
        const rec = {
          id: `prv-${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        dbProvisions.push(rec);
        return rec;
      }),
      findProvisionById: jest
        .fn()
        .mockImplementation((id) => dbProvisions.find((p) => p.id === id) || null),
      updateProvisionStatus: jest.fn().mockImplementation((id, status, updateObj) => {
        const item = dbProvisions.find((p) => p.id === id);
        if (item) {
          item.status = status;
          Object.assign(item, updateObj);
        }
        return item;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccrualsService,
        { provide: AccrualsRepository, useValue: mockRepo },
        { provide: AccountingService, useValue: accounting },
      ],
    }).compile();

    service = module.get<AccrualsService>(AccrualsService);
  });

  it('1. should complete accrued expense lifecycle', async () => {
    const accrual = await service.createAccrual(
      {
        orgNodeId: mockOrgNodeId,
        expenseAccountId: mockExpenseAcc,
        accruedLiabilityAccountId: mockLiabilityAcc,
        accrualDate: '2026-08-31',
        amount: 25000,
        description: 'August Salaries Accrual',
      },
      mockUserId,
    );

    expect(accrual.status).toBe('accrued');
    expect(parseFloat(accrual.amount)).toBe(25000);

    const posted = await service.postAccrual(accrual.id, mockUserId);
    expect(posted.accrual.status).toBe('accrued');
    expect(posted.journalEntry.lines).toHaveLength(2);

    expect(posted.journalEntry.lines[0]).toEqual(
      expect.objectContaining({ accountId: mockExpenseAcc, debitAmount: '25000.0000' }),
    );
    // posting twice is refused (it used to write a second journal)
    await expect(service.postAccrual(accrual.id, mockUserId)).rejects.toThrow('already posted');

    const reversed = await service.reverseAccrual(accrual.id, '2026-09-05', mockUserId);
    expect(reversed.accrual.status).toBe('reversed');
    expect(reversed.reversalJournal.lines[0]).toEqual(
      expect.objectContaining({ accountId: mockLiabilityAcc, debitAmount: '25000.0000' }),
    );
    await expect(service.reverseAccrual(accrual.id, '2026-09-06', mockUserId)).rejects.toThrow();
  });

  it('2. should manage prepaid amortization', async () => {
    const prepaid = await service.createPrepaid(
      {
        orgNodeId: mockOrgNodeId,
        prepaidAssetAccountId: mockAssetAcc,
        expenseAccountId: mockExpenseAcc,
        paymentDate: '2026-01-01',
        coverageStartDate: '2026-01-01',
        coverageEndDate: '2026-12-31',
        totalAmount: 120000,
        monthlyAmortization: 10000,
        description: 'Annual Insurance Prepaid',
      },
      mockUserId,
    );

    expect(parseFloat(prepaid.remainingAmount)).toBe(120000);

    const step1 = await service.amortizeMonth(prepaid.id, 10000, mockUserId);
    expect(parseFloat(step1.prepaid.consumedAmount)).toBe(10000);
    expect(parseFloat(step1.prepaid.remainingAmount)).toBe(110000);
  });

  it('3. amortization never goes past what is left, and the journal matches', async () => {
    const prepaid = await service.createPrepaid(
      {
        orgNodeId: mockOrgNodeId,
        prepaidAssetAccountId: mockAssetAcc,
        expenseAccountId: mockExpenseAcc,
        paymentDate: '2026-01-01',
        coverageStartDate: '2026-01-01',
        coverageEndDate: '2026-02-28',
        totalAmount: 15000,
        monthlyAmortization: 10000,
        description: 'Two-month rent',
      },
      mockUserId,
    );
    await service.amortizeMonth(prepaid.id, 10000, mockUserId);
    const last = await service.amortizeMonth(prepaid.id, 10000, mockUserId);
    expect(last.prepaid.status).toBe('fully_consumed');
    expect(last.journalEntry.lines[0]!.debitAmount).toBe('5000.0000');
    await expect(service.amortizeMonth(prepaid.id, 1, mockUserId)).rejects.toThrow();
  });

  it('4. a warranty provision is posted when created and used against the real cost source', async () => {
    const provision = await service.createProvision(
      {
        orgNodeId: mockOrgNodeId,
        warrantyExpenseAccountId: mockExpenseAcc,
        provisionLiabilityAccountId: mockLiabilityAcc,
        provisionDate: '2026-08-01',
        baseAmount: 200000,
        provisionRate: 2,
        description: 'ICU beds warranty',
      },
      mockUserId,
    );
    expect(provision.provisionAmount).toBe('4000.0000');
    expect(entries[0]!.lines[0]).toEqual(
      expect.objectContaining({ accountId: mockExpenseAcc, debitAmount: '4000.0000' }),
    );
    const cash = '88888888-8888-8888-8888-888888888888';
    const used = await service.utilizeProvision(provision.id, 5000, cash, mockUserId);
    expect(used.provision.status).toBe('fully_utilized');
    expect(used.utilizationJournal.lines).toEqual([
      expect.objectContaining({ accountId: mockLiabilityAcc, debitAmount: '4000.0000' }),
      expect.objectContaining({ accountId: cash, creditAmount: '4000.0000' }),
    ]);
  });
});
