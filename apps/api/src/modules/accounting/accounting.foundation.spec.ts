import { AccountingValidationError } from './accounting.errors';
import { AccountingService } from './accounting.service';

describe('Accounting Foundation & Costing Core (Unit/Logic Tests)', () => {
  let service: AccountingService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      listAccountTypes: jest.fn(),
      findAccountTypeByCode: jest.fn(),
      findAccountTypeById: jest.fn(),
      insertAccountType: jest.fn(),
      listAccounts: jest.fn(),
      findAccountById: jest.fn(),
      findAccountByCode: jest.fn(),
      insertAccount: jest.fn(),
      markAsParent: jest.fn(),
      listFiscalYears: jest.fn(),
      findFiscalYearById: jest.fn(),
      findFiscalYearByDate: jest.fn(),
      insertFiscalYear: jest.fn().mockImplementation((input) => ({ ...input, isClosed: false })),
      closeFiscalYear: jest.fn(),
      listPeriods: jest.fn(),
      findPeriodById: jest.fn(),
      findPeriodByDate: jest.fn(),
      insertPeriod: jest.fn().mockImplementation((input) => ({ ...input, status: 'open' })),
      setPeriodStatus: jest.fn().mockImplementation((id, status) => ({ id, status })),
      listCostCenters: jest.fn(),
      findCostCenterById: jest.fn(),
      findCostCenterByCode: jest.fn(),
      insertCostCenter: jest.fn().mockImplementation((input) => input),
      findAccountingOrgNode: jest.fn(async (id: string) => id),
      findCompanyConfig: jest.fn(),
      upsertCompanyConfig: jest.fn().mockImplementation((input) => input),
      listAccountDeterminations: jest.fn(),
      insertAccountDetermination: jest.fn().mockImplementation((input) => input),
      listEntries: jest.fn(),
      findEntryById: jest.fn(),
      countEntries: jest.fn().mockResolvedValue(0),
      insertEntry: jest.fn().mockImplementation((input) => ({ ...input, status: 'draft' })),
      setEntryStatus: jest.fn().mockImplementation((id, status) => ({ id, status })),
    };

    service = new AccountingService(mockRepo);
  });

  describe('Fiscal Year & 12 Periods Auto-Generation', () => {
    it('should create fiscal year and automatically generate 12 monthly periods', async () => {
      const input = {
        orgNodeId: '11111111-1111-1111-1111-111111111111',
        name: 'FY-2026',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.999Z',
      };

      const fy = await service.createFiscalYear(input);

      expect(fy.name).toBe('FY-2026');
      expect(mockRepo.insertFiscalYear).toHaveBeenCalledTimes(1);
      // Verify that exactly 12 periods were generated
      expect(mockRepo.insertPeriod).toHaveBeenCalledTimes(12);
    });

    it('should reject invalid dates where end date is before start date', async () => {
      const input = {
        orgNodeId: '11111111-1111-1111-1111-111111111111',
        name: 'Invalid-FY',
        startDate: '2026-12-31T00:00:00.000Z',
        endDate: '2026-01-01T00:00:00.000Z',
      };

      await expect(service.createFiscalYear(input)).rejects.toThrow(AccountingValidationError);
    });
  });

  describe('Closed Period Protection', () => {
    it('should prevent creating a journal entry in a closed period', async () => {
      const orgNodeId = '11111111-1111-1111-1111-111111111111';
      const entryDate = '2026-01-15T00:00:00.000Z';

      mockRepo.findFiscalYearByDate.mockResolvedValue({ id: 'fy-1', orgNodeId });
      mockRepo.findPeriodByDate.mockResolvedValue({ id: 'p-1', name: 'M01-Jan', status: 'closed' });

      const entryInput = {
        orgNodeId,
        description: 'Test entry in closed period',
        entryDate,
        lines: [
          { accountId: 'acc-1', debitAmount: '1000' },
          { accountId: 'acc-2', creditAmount: '1000' },
        ],
      };

      await expect(service.createEntry(entryInput)).rejects.toThrow(
        /cannot post into closed periods/i,
      );
    });
  });

  describe('Double-Entry Balance Validation', () => {
    it('should reject posting an unbalanced journal entry', async () => {
      const entryId = 'entry-unbalanced';
      mockRepo.findEntryById.mockResolvedValue({
        id: entryId,
        status: 'draft',
        lines: [
          { accountId: 'acc-1', debitAmount: '1000', creditAmount: '0' },
          { accountId: 'acc-2', debitAmount: '0', creditAmount: '900' }, // Unbalanced: diff = 100
        ],
      });

      await expect(service.postEntry(entryId)).rejects.toThrow(/does not balance/i);
    });

    it('should successfully post a balanced journal entry', async () => {
      const entryId = 'entry-balanced';
      mockRepo.findEntryById.mockResolvedValue({
        id: entryId,
        status: 'draft',
        lines: [
          { accountId: 'acc-1', debitAmount: '500', creditAmount: '0' },
          { accountId: 'acc-2', debitAmount: '0', creditAmount: '500' },
        ],
      });

      const res = await service.postEntry(entryId);
      expect(res.status).toBe('posted');
      expect(mockRepo.setEntryStatus).toHaveBeenCalledWith(entryId, 'posted');
    });
  });
});
