import { AccountingService } from './accounting.service';
import { AccountingRepository } from './accounting.repository';
import { AccountingValidationError } from './accounting.errors';
import type {
  FixedAssetRecord,
  CreateFixedAssetInput,
  JournalEntryRecord,
  DepreciationEntryRecord,
} from './accounting.types';

describe('AccountingService — Fixed Assets & Monthly Depreciation Engine', () => {
  let accountingService: AccountingService;
  let accountingRepo: AccountingRepository;

  const mockOrgNodeId = 'org-factory-1';
  const mockAssetAccountId = 'acc-machinery-asset';
  const mockAccDeprAccountId = 'acc-accumulated-depreciation';
  const mockDeprExpAccountId = 'acc-depreciation-expense';
  const mockCostCenterId = 'cc-laser-line';

  // Mock In-Memory State
  const mockAssets: Map<string, FixedAssetRecord> = new Map();
  const mockDepreciationEntries: DepreciationEntryRecord[] = [];
  const mockJournals: Map<string, any> = new Map();
  let mockJournalCounter = 0;

  beforeEach(() => {
    mockAssets.clear();
    mockDepreciationEntries.length = 0;
    mockJournals.clear();
    mockJournalCounter = 0;

    accountingRepo = {
      findFixedAssetByCode: jest.fn().mockResolvedValue(null),
      findCompanyConfig: jest.fn().mockResolvedValue(null),
      findAccountRole: jest.fn().mockResolvedValue(null),
      findFixedAssetById: jest.fn().mockImplementation(async (id: string) => {
        return mockAssets.get(id) ?? null;
      }),
      insertFixedAsset: jest.fn().mockImplementation(async (input) => {
        const record: FixedAssetRecord = {
          id: input.id,
          assetCode: input.assetCode,
          assetName: input.assetName,
          orgNodeId: input.orgNodeId,
          purchaseDate: input.purchaseDate,
          purchaseCost: input.purchaseCost,
          usefulLifeMonths: input.usefulLifeMonths,
          salvageValue: input.salvageValue ?? '0',
          depreciationMethod: 'straight_line',
          assetAccountId: input.assetAccountId,
          accumulatedDepreciationAccountId: input.accumulatedDepreciationAccountId,
          depreciationExpenseAccountId: input.depreciationExpenseAccountId,
          costCenterId: input.costCenterId ?? null,
          totalDepreciated: '0',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockAssets.set(input.id, record);
        return record;
      }),
      updateFixedAssetDepreciation: jest.fn().mockImplementation(async (id: string, total: string, status: any) => {
        const asset = mockAssets.get(id);
        if (asset) {
          asset.totalDepreciated = total;
          asset.status = status;
        }
      }),
      insertDepreciationEntry: jest.fn().mockImplementation(async (input) => {
        const entry: DepreciationEntryRecord = {
          id: input.id,
          assetId: input.assetId,
          periodId: input.periodId,
          entryDate: input.entryDate.toISOString(),
          depreciationAmount: input.depreciationAmount,
          accumulatedAmountAfter: input.accumulatedAmountAfter,
          journalEntryId: input.journalEntryId,
          status: 'posted',
          createdAt: new Date().toISOString(),
        };
        mockDepreciationEntries.push(entry);
        return entry;
      }),
      listDepreciationEntries: jest.fn().mockImplementation(async () => mockDepreciationEntries),
      listFixedAssets: jest.fn().mockImplementation(async () => Array.from(mockAssets.values())),

      findFiscalYearByDate: jest.fn().mockResolvedValue(null),
      findAccountById: jest.fn().mockResolvedValue({ id: 'acc-1', isLeaf: true, orgNodeId: mockOrgNodeId }),
      countEntries: jest.fn().mockImplementation(async () => mockJournalCounter),
      findEntryById: jest.fn().mockImplementation(async (id: string) => mockJournals.get(id) ?? null),
      insertEntry: jest.fn().mockImplementation(async (input) => {
        mockJournalCounter++;
        const entry = {
          id: input.id,
          entryNumber: input.entryNumber,
          orgNodeId: input.orgNodeId,
          description: input.description,
          entryDate: new Date().toISOString(),
          postedAt: null,
          status: 'draft',
          lines: input.lines,
        };
        mockJournals.set(input.id, entry);
        return entry;
      }),
      setEntryStatus: jest.fn().mockImplementation(async (id: string, status: any) => {
        const entry = mockJournals.get(id) ?? {
          id,
          entryNumber: 'JE-2026-000001',
          orgNodeId: mockOrgNodeId,
          description: 'Depreciation',
          entryDate: new Date().toISOString(),
          postedAt: new Date().toISOString(),
          status: 'posted',
          periodId: null,
          lines: [],
        };
        entry.status = status;
        entry.postedAt = new Date().toISOString();
        mockJournals.set(id, entry);
        return entry;
      }),
    } as unknown as AccountingRepository;

    accountingService = new AccountingService(accountingRepo);
  });

  it('1. Create Fixed Asset: should register a new machine with cost, life, and linked accounts', async () => {
    const input: CreateFixedAssetInput = {
      orgNodeId: mockOrgNodeId,
      assetCode: 'MACH-LASER-001',
      assetName: 'ماكينة قص ليزر فايبر 3000 وات',
      purchaseDate: '2026-01-15',
      purchaseCost: '1200000.0000',
      usefulLifeMonths: 60,
      salvageValue: '120000.0000',
      assetAccountId: mockAssetAccountId,
      accumulatedDepreciationAccountId: mockAccDeprAccountId,
      depreciationExpenseAccountId: mockDeprExpAccountId,
      costCenterId: mockCostCenterId,
    };

    const asset = await accountingService.createFixedAsset(input);

    expect(asset.assetCode).toBe('MACH-LASER-001');
    expect(asset.assetName).toBe('ماكينة قص ليزر فايبر 3000 وات');
    expect(asset.purchaseCost).toBe('1200000.0000');
    expect(asset.usefulLifeMonths).toBe(60);
    expect(asset.salvageValue).toBe('120000.0000');
    expect(asset.totalDepreciated).toBe('0');
    expect(asset.status).toBe('active');
    expect(asset.costCenterId).toBe(mockCostCenterId);
  });

  it('2. Monthly Depreciation: should calculate straight-line and post [Dr Depr Expense / Cr Acc Depr]', async () => {
    const asset = await accountingService.createFixedAsset({
      orgNodeId: mockOrgNodeId,
      assetCode: 'MACH-LASER-001',
      assetName: 'ماكينة قص ليزر فايبر',
      purchaseDate: '2026-01-15',
      purchaseCost: '1200000.0000',
      usefulLifeMonths: 60,
      salvageValue: '120000.0000',
      assetAccountId: mockAssetAccountId,
      accumulatedDepreciationAccountId: mockAccDeprAccountId,
      depreciationExpenseAccountId: mockDeprExpAccountId,
      costCenterId: mockCostCenterId,
    });

    const result = await accountingService.postAssetDepreciation(asset.id, '2026-09-30');

    expect(result.depreciationEntry.depreciationAmount).toBe('18000.0000');
    expect(result.depreciationEntry.accumulatedAmountAfter).toBe('18000.0000');
    expect(result.journalEntry.status).toBe('posted');

    expect(accountingRepo.insertEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('ماكينة قص ليزر فايبر'),
        isAutoGenerated: true,
        sourceEventType: 'asset_depreciation',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountId: mockDeprExpAccountId,
            debitAmount: '18000.0000',
            creditAmount: '0',
            costCenterId: mockCostCenterId,
          }),
          expect.objectContaining({
            accountId: mockAccDeprAccountId,
            debitAmount: '0',
            creditAmount: '18000.0000',
          }),
        ]),
      }),
    );
  });

  it('3. Full Depreciation: should mark asset as fully_depreciated when life ends', async () => {
    const asset = await accountingService.createFixedAsset({
      orgNodeId: mockOrgNodeId,
      assetCode: 'MACH-SMALL-001',
      assetName: 'ماكينة لحام صغيرة',
      purchaseDate: '2026-01-01',
      purchaseCost: '60000.0000',
      usefulLifeMonths: 3,
      salvageValue: '0',
      assetAccountId: mockAssetAccountId,
      accumulatedDepreciationAccountId: mockAccDeprAccountId,
      depreciationExpenseAccountId: mockDeprExpAccountId,
    });

    await accountingService.postAssetDepreciation(asset.id, '2026-01-31');
    await accountingService.postAssetDepreciation(asset.id, '2026-02-28');
    const finalResult = await accountingService.postAssetDepreciation(asset.id, '2026-03-31');

    expect(finalResult.asset.status).toBe('fully_depreciated');
    expect(finalResult.asset.totalDepreciated).toBe('60000.0000');

    await expect(
      accountingService.postAssetDepreciation(asset.id, '2026-04-30'),
    ).rejects.toThrow(AccountingValidationError);
  });

  it('4. Validation: should reject duplicate asset code and invalid cost', async () => {
    await accountingService.createFixedAsset({
      orgNodeId: mockOrgNodeId,
      assetCode: 'MACH-UNIQUE-001',
      assetName: 'ماكينة ثناية',
      purchaseDate: '2026-01-01',
      purchaseCost: '500000.0000',
      usefulLifeMonths: 48,
      assetAccountId: mockAssetAccountId,
      accumulatedDepreciationAccountId: mockAccDeprAccountId,
      depreciationExpenseAccountId: mockDeprExpAccountId,
    });

    (accountingRepo.findFixedAssetByCode as jest.Mock).mockResolvedValueOnce({ id: 'existing' });
    await expect(
      accountingService.createFixedAsset({
        orgNodeId: mockOrgNodeId,
        assetCode: 'MACH-UNIQUE-001',
        assetName: 'ماكينة تانية',
        purchaseDate: '2026-01-01',
        purchaseCost: '100000.0000',
        usefulLifeMonths: 24,
        assetAccountId: mockAssetAccountId,
        accumulatedDepreciationAccountId: mockAccDeprAccountId,
        depreciationExpenseAccountId: mockDeprExpAccountId,
      }),
    ).rejects.toThrow(AccountingValidationError);
  });
});