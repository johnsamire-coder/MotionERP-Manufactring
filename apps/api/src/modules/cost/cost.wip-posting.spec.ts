import { PostingEngineService } from '../accounting/posting-engine.service';
import { AccountingService } from '../accounting/accounting.service';
import { AccountingRepository } from '../accounting/accounting.repository';
import type {
  CompanyAccountingConfigRecord,
  AccountDeterminationRecord,
} from '../accounting/accounting.types';
import type { StockMovementPostingPayload } from '../accounting/posting-engine.types';

describe('Manufacturing Costing — WIP Accounting & FG Receipt Posting', () => {
  let postingEngine: PostingEngineService;
  let accountingRepo: AccountingRepository;
  let accountingService: AccountingService;

  const mockOrgNodeId = 'org-factory-1';
  const mockRawWarehouseId = 'wh-raw-materials';
  const mockFgWarehouseId = 'wh-finished-goods';

  const mockRawInvAccount = 'acc-raw-inventory-asset';
  const mockFgInvAccount = 'acc-fg-inventory-asset';
  const mockWipAccount = 'acc-wip-manufacturing';
  const mockGrniAccount = 'acc-grni-liability';

  beforeEach(() => {
    accountingRepo = {
      findCompanyConfig: jest.fn().mockResolvedValue({
        orgNodeId: mockOrgNodeId,
        defaultGrniAccountId: mockGrniAccount,
        defaultWipAccountId: mockWipAccount,
      } as CompanyAccountingConfigRecord),

      listAccountDeterminations: jest.fn().mockResolvedValue([
        {
          orgNodeId: mockOrgNodeId,
          determinationType: 'warehouse',
          referenceId: mockRawWarehouseId,
          accountPurpose: 'inventory',
          accountId: mockRawInvAccount,
        } as AccountDeterminationRecord,
        {
          orgNodeId: mockOrgNodeId,
          determinationType: 'warehouse',
          referenceId: mockFgWarehouseId,
          accountPurpose: 'inventory',
          accountId: mockFgInvAccount,
        } as AccountDeterminationRecord,
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'wip',
          accountId: mockWipAccount,
        } as AccountDeterminationRecord,
        {
          orgNodeId: mockOrgNodeId,
          accountPurpose: 'grni',
          accountId: mockGrniAccount,
        } as AccountDeterminationRecord,
      ]),

      findEntryByIdempotencyKey: jest.fn().mockResolvedValue(null),
    } as unknown as AccountingRepository;

    accountingService = {
      createEntry: jest.fn().mockImplementation(async (input) => ({
        id: 'je-mfg-1',
        entryNumber: 'JE-2026-MFG-001',
        orgNodeId: input.orgNodeId,
        description: input.description,
        entryDate: new Date().toISOString(),
        postedAt: null,
        status: 'draft',
        lines: input.lines.map((l: any, idx: number) => ({
          id: `jl-${idx + 1}`,
          accountId: l.accountId,
          debitAmount: l.debitAmount ?? '0',
          creditAmount: l.creditAmount ?? '0',
          description: l.description,
        })),
      })),
      postEntry: jest.fn().mockImplementation(async (id: string) => ({
        id,
        status: 'posted',
        postedAt: new Date().toISOString(),
      })),
    } as unknown as AccountingService;

    postingEngine = new PostingEngineService(accountingRepo, accountingService);
  });

  it('1. Raw Material Issue to Production: should generate [Dr WIP / Cr Raw Material Inventory]', async () => {
    const payload: StockMovementPostingPayload = {
      movementId: 'mov-issue-raw-1',
      itemId: 'item-steel-sheet-60',
      warehouseId: mockRawWarehouseId,
      orgNodeId: mockOrgNodeId,
      movementType: 'issue',
      quantity: '10',
      unitCost: '150.000000',
      totalValue: '1500.0000',
      sourceModule: 'production',
      sourceId: 'wo-job-001',
      note: 'صرف صاج مجلفن لتصنيع وحدة درج وضلفة 60',
    };

    const entry = await postingEngine.postStockMovement(payload);

    expect(entry).not.toBeNull();
    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('صرف صاج مجلفن لتصنيع وحدة درج وضلفة 60'),
        lines: expect.arrayContaining([
          // Dr WIP (1500 EGP)
          expect.objectContaining({
            accountId: mockWipAccount,
            debitAmount: '1500.0000',
            creditAmount: '0',
          }),
          // Cr Raw Material Inventory (1500 EGP)
          expect.objectContaining({
            accountId: mockRawInvAccount,
            debitAmount: '0',
            creditAmount: '1500.0000',
          }),
        ]),
      }),
    );
  });

  it('2. Finished Goods Receipt from Production: should generate [Dr FG Inventory / Cr WIP]', async () => {
    const payload: StockMovementPostingPayload = {
      movementId: 'mov-fg-receipt-1',
      itemId: 'item-drawer-unit-60',
      warehouseId: mockFgWarehouseId,
      orgNodeId: mockOrgNodeId,
      movementType: 'receipt',
      quantity: '1',
      unitCost: '3934.410000',
      totalValue: '3934.4100',
      sourceModule: 'production', // Crucial: Marks movement as manufacturing output
      sourceId: 'wo-job-001',
      note: 'استلام منتج تام الصنع: وحدة درج وضلفة 60',
    };

    const entry = await postingEngine.postStockMovement(payload);

    expect(entry).not.toBeNull();
    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('استلام منتج تام الصنع: وحدة درج وضلفة 60'),
        lines: expect.arrayContaining([
          // Dr Finished Goods Inventory (3934.41 EGP)
          expect.objectContaining({
            accountId: mockFgInvAccount,
            debitAmount: '3934.4100',
            creditAmount: '0',
          }),
          // Cr WIP Account (3934.41 EGP) — Clears the Work in Progress balance
          expect.objectContaining({
            accountId: mockWipAccount,
            debitAmount: '0',
            creditAmount: '3934.4100',
          }),
        ]),
      }),
    );
  });

  it('3. Supplier Purchase Receipt (Non-Production): should generate [Dr Raw Inventory / Cr GRNI]', async () => {
    const payload: StockMovementPostingPayload = {
      movementId: 'mov-supplier-receipt-1',
      itemId: 'item-steel-sheet-60',
      warehouseId: mockRawWarehouseId,
      orgNodeId: mockOrgNodeId,
      movementType: 'receipt',
      quantity: '50',
      unitCost: '100.000000',
      totalValue: '5000.0000',
      sourceModule: 'purchasing', // Normal purchase receipt
      note: 'استلام مشتريات صاج من المورد',
    };

    const entry = await postingEngine.postStockMovement(payload);

    expect(entry).not.toBeNull();
    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          // Dr Raw Inventory (5000 EGP)
          expect.objectContaining({
            accountId: mockRawInvAccount,
            debitAmount: '5000.0000',
            creditAmount: '0',
          }),
          // Cr GRNI Liability (5000 EGP)
          expect.objectContaining({
            accountId: mockGrniAccount,
            debitAmount: '0',
            creditAmount: '5000.0000',
          }),
        ]),
      }),
    );
  });
});
