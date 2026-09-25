import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { PostingEngineService } from '../accounting/posting-engine.service';
import { AccountingService } from '../accounting/accounting.service';
import { InventoryValidationError } from './inventory.errors';
import type {
  LandedCostVoucherRecord,
  CreateLandedCostVoucherInput,
  StockBalanceRecord,
  StockLedgerEntryRecord,
} from './inventory.types';

describe('InventoryService — Landed Cost Voucher & Expense Capitalization Engine', () => {
  let inventoryService: InventoryService;
  let inventoryRepo: InventoryRepository;
  let postingEngine: PostingEngineService;
  let accountingService: AccountingService;

  const mockOrgNodeId = 'org-medical-factory-1';
  const mockWarehouseId = 'wh-raw-materials';
  const mockItemId = 'item-steel-sheet-60';
  const mockFreightAccountId = 'acc-freight-expense-clearing';
  const mockRawInvAccount = 'acc-raw-inventory-asset';

  // Mock In-Memory State
  let mockBalance: { onHand: number; averageCost: number; totalValue: number } | null = null;
  const mockLedger: StockLedgerEntryRecord[] = [];
  const mockVouchers: Map<string, LandedCostVoucherRecord> = new Map();
  const mockPostedJournals: any[] = [];

  beforeEach(() => {
    // Initial Stock: 50 sheets @ 100 EGP = 5,000 EGP
    mockBalance = { onHand: 50, averageCost: 100, totalValue: 5000 };
    mockLedger.length = 0;
    mockVouchers.clear();
    mockPostedJournals.length = 0;

    inventoryRepo = {
      countLandedCostVouchers: jest.fn().mockImplementation(async () => mockVouchers.size),
      insertLandedCostVoucher: jest.fn().mockImplementation(async (input) => {
        const record: LandedCostVoucherRecord = {
          id: input.id,
          voucherNumber: input.voucherNumber,
          orgNodeId: input.orgNodeId,
          postingDate: input.postingDate ?? new Date().toISOString(),
          totalExpenseAmount: input.totalExpenseAmount,
          distributeMethod: input.distributeMethod ?? 'by_amount',
          expenseAccountId: input.expenseAccountId,
          status: 'draft',
          notes: input.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: input.computedItems.map((item: any) => ({
            ...item,
            voucherId: input.id,
            createdAt: new Date().toISOString(),
          })),
        };
        mockVouchers.set(input.id, record);
        return record;
      }),
      findLandedCostVoucherById: jest.fn().mockImplementation(async (id: string) => {
        return mockVouchers.get(id) ?? null;
      }),
      setLandedCostVoucherStatus: jest.fn().mockImplementation(async (id: string, status: any) => {
        const v = mockVouchers.get(id);
        if (v) {
          v.status = status;
          v.updatedAt = new Date().toISOString();
        }
        return v;
      }),
      findLatestMovementDate: jest.fn().mockResolvedValue(null),
      findMovementById: jest.fn().mockResolvedValue({ id: 'm', batchId: null }),
      findBalance: jest.fn().mockImplementation(async (itemId: string, warehouseId: string) => {
        if (!mockBalance) return null;
        return {
          id: 'bal-1',
          itemId,
          warehouseId,
          onHand: String(mockBalance.onHand),
          reserved: '0',
          available: String(mockBalance.onHand),
          averageCost: String(mockBalance.averageCost),
          totalValue: String(mockBalance.totalValue),
          updatedAt: new Date().toISOString(),
        } as StockBalanceRecord;
      }),
      applyValuation: jest.fn().mockImplementation(async (_itemId, _whId, v) => {
        if (mockBalance) {
          mockBalance.averageCost = Number(v.averageCost);
          mockBalance.totalValue = Number(v.totalValue);
        }
      }),
      insertLedgerEntry: jest.fn().mockImplementation(async (input) => {
        const record: StockLedgerEntryRecord = {
          id: input.id,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          movementId: input.movementId ?? null,
          quantityChange: input.quantityChange,
          balanceQtyAfter: input.balanceQtyAfter,
          incomingRate: input.incomingRate ?? '0',
          valuationRate: input.valuationRate ?? '0',
          stockValueChange: input.stockValueChange ?? '0',
          stockValueAfter: input.stockValueAfter ?? '0',
          createdAt: new Date().toISOString(),
        };
        mockLedger.push(record);
        return record;
      }),
    } as unknown as InventoryRepository;

    accountingService = {
      createEntry: jest.fn().mockImplementation(async (input) => {
        const je = {
          id: `je-lcv-${mockPostedJournals.length + 1}`,
          entryNumber: `JE-LCV-00${mockPostedJournals.length + 1}`,
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

    postingEngine = {
      accountingService,
      resolveStockMovementAccounts: jest.fn().mockResolvedValue({
        inventoryAccountId: mockRawInvAccount,
        contraAccountId: 'acc-grni',
      }),
    } as unknown as PostingEngineService;

    inventoryService = new InventoryService(inventoryRepo, postingEngine);
  });

  it('1. Create Landed Cost Voucher: should distribute 1,000 EGP freight over 50 sheets (100 -> 120 EGP/sheet)', async () => {
    const input: CreateLandedCostVoucherInput = {
      orgNodeId: mockOrgNodeId,
      totalExpenseAmount: '1000.0000',
      distributeMethod: 'by_amount',
      expenseAccountId: mockFreightAccountId,
      notes: 'مصاريف نقل ومشال الصاج من المورد',
      items: [
        {
          receiptMovementId: 'mov-receipt-001',
          itemId: mockItemId,
          warehouseId: mockWarehouseId,
          quantity: '50.000000',
          originalRate: '100.000000',
        },
      ],
    };

    const voucher = await inventoryService.createLandedCostVoucher(input);

    expect(voucher.voucherNumber).toBe('LCV-2026-000001');
    expect(voucher.totalExpenseAmount).toBe('1000.0000');
    expect(voucher.status).toBe('draft');
    expect(voucher.items.length).toBe(1);

    const item = voucher.items[0]!;
    expect(item.allocatedExpense).toBe('1000.0000');
    // New rate = 100 + (1000 / 50) = 120 EGP / sheet
    expect(item.newValuationRate).toBe('120.000000');
  });

  it('2. Post Landed Cost Voucher: should revalue inventory in Stock Ledger & post [Dr Inventory / Cr Freight Clearing]', async () => {
    const voucher = await inventoryService.createLandedCostVoucher({
      orgNodeId: mockOrgNodeId,
      totalExpenseAmount: '1000.0000',
      expenseAccountId: mockFreightAccountId,
      items: [
        {
          receiptMovementId: 'mov-receipt-001',
          itemId: mockItemId,
          warehouseId: mockWarehouseId,
          quantity: '50.000000',
          originalRate: '100.000000',
        },
      ],
    });

    const postedVoucher = await inventoryService.postLandedCostVoucher(voucher.id);

    expect(postedVoucher.status).toBe('posted');

    // Verify Stock Valuation updated: 50 sheets @ 120 EGP = 6,000 EGP total value
    expect(mockBalance?.averageCost).toBe(120);
    expect(mockBalance?.totalValue).toBe(6000);

    // Verify Stock Ledger revaluation entry recorded
    expect(mockLedger.length).toBe(1);
    expect(mockLedger[0]?.valuationRate).toBe('120.000000');
    expect(mockLedger[0]?.stockValueChange).toBe('1000.0000');
    expect(mockLedger[0]?.stockValueAfter).toBe('6000.0000');

    // Verify Capitalization Journal Entry: [Dr Raw Inventory (1000) / Cr Freight Clearing (1000)]
    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orgNodeId: mockOrgNodeId,
        isAutoGenerated: true,
        sourceEventType: 'landed_cost',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountId: mockRawInvAccount,
            debitAmount: '1000.0000',
            creditAmount: '0',
          }),
          expect.objectContaining({
            accountId: mockFreightAccountId,
            debitAmount: '0',
            creditAmount: '1000.0000',
          }),
        ]),
      }),
    );
    expect(accountingService.postEntry).toHaveBeenCalledTimes(1);
  });

  it('3. Security & Validation: should reject voucher with empty items or non-positive expense', async () => {
    await expect(
      inventoryService.createLandedCostVoucher({
        orgNodeId: mockOrgNodeId,
        totalExpenseAmount: '0',
        expenseAccountId: mockFreightAccountId,
        items: [],
      }),
    ).rejects.toThrow(InventoryValidationError);

    await expect(
      inventoryService.createLandedCostVoucher({
        orgNodeId: mockOrgNodeId,
        totalExpenseAmount: '500',
        expenseAccountId: mockFreightAccountId,
        items: [],
      }),
    ).rejects.toThrow(InventoryValidationError);
  });
});
