import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { PostingEngineService } from '../accounting/posting-engine.service';
import { InventoryValidationError, InventoryNotFoundError } from './inventory.errors';
import type {
  ReconcileStockInput,
  StockBalanceRecord,
  StockMovementRecord,
  StockLedgerEntryRecord,
  WarehouseRecord,
} from './inventory.types';

describe('InventoryService — Stock Reconciliation & Inventory Adjustment Engine', () => {
  let inventoryService: InventoryService;
  let inventoryRepo: InventoryRepository;
  let postingEngine: PostingEngineService;

  const mockOrgNodeId = 'org-medical-factory-1';
  const mockWarehouseId = 'wh-raw-materials';
  const mockItemId = 'item-steel-sheet-60';

  // Mock In-Memory State
  let mockBalance: { onHand: number; averageCost: number; totalValue: number; reserved: number } | null = null;
  const mockMovements: StockMovementRecord[] = [];
  const mockLedger: StockLedgerEntryRecord[] = [];
  const postedMovements: any[] = [];

  beforeEach(() => {
    mockBalance = { onHand: 50, averageCost: 100, totalValue: 5000, reserved: 0 };
    mockMovements.length = 0;
    mockLedger.length = 0;
    postedMovements.length = 0;

    inventoryRepo = {
      findWarehouseById: jest.fn().mockImplementation(async (id: string) => {
        if (id === mockWarehouseId) {
          return { id: mockWarehouseId, code: 'WH-RAW', name: 'مخزن الخامات', orgNodeId: mockOrgNodeId } as WarehouseRecord;
        }
        return null;
      }),
      findLatestMovementDate: jest.fn().mockResolvedValue(null),
      findBalance: jest.fn().mockImplementation(async (itemId: string, warehouseId: string) => {
        if (!mockBalance) return null;
        return {
          id: 'bal-1',
          itemId,
          warehouseId,
          onHand: String(mockBalance.onHand),
          reserved: String(mockBalance.reserved),
          averageCost: String(mockBalance.averageCost),
          totalValue: String(mockBalance.totalValue),
          available: String(mockBalance.onHand - mockBalance.reserved),
          updatedAt: new Date().toISOString(),
          lastPurchaseCost: '100.000000',
          lastPurchaseAt: null,
        } as StockBalanceRecord;
      }),
      insertMovement: jest.fn().mockImplementation(async (input) => {
        const record: StockMovementRecord = {
          id: input.id,
          itemId: input.itemId,
          warehouseId: input.warehouseId,
          movementType: input.movementType,
          quantity: input.quantity,
          movementDate: input.movementDate,
          note: input.note ?? null,
          createdAt: new Date().toISOString(),
          unitCost: input.unitCost ?? null,
          totalValue: input.totalValue ?? null,
          sourceModule: input.sourceModule ?? null,
          sourceId: input.sourceId ?? null,
        };
        mockMovements.push(record);
        return record;
      }),
      applyDelta: jest.fn().mockImplementation(async (_itemId, _whId, delta: string) => {
        if (mockBalance) {
          mockBalance.onHand += Number(delta);
        }
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

    postingEngine = {
      postStockMovement: jest.fn().mockImplementation(async (payload) => {
        postedMovements.push(payload);
        return { id: 'je-reconcile-1' };
      }),
    } as unknown as PostingEngineService;

    inventoryService = new InventoryService(inventoryRepo, postingEngine);
  });

  it('1. Shortage / Deficit Reconciliation: should reduce on-hand, record ledger and trigger GL posting for loss', async () => {
    // Current onHand = 50 @ 100 EGP = 5,000 EGP
    // Physical count found 45 sheets (Shortage of 5 sheets = 500 EGP Loss)
    const input: ReconcileStockInput = {
      itemId: mockItemId,
      warehouseId: mockWarehouseId,
      physicalQty: '45',
      note: 'جرد فعلي ربع سنوي: عجز 5 ألواح صاج',
    };

    const result = await inventoryService.reconcileStock(input);

    expect(result.previousQty).toBe('50.000000');
    expect(result.physicalQty).toBe('45.000000');
    expect(result.differenceQty).toBe('-5.000000');
    expect(result.adjustmentType).toBe('shortage');

    // Balance updated
    expect(mockBalance?.onHand).toBe(45);
    expect(mockBalance?.totalValue).toBe(4500);

    // Ledger entry recorded with negative value change
    expect(mockLedger.length).toBe(1);
    expect(mockLedger[0]?.balanceQtyAfter).toBe('45.000000');
    expect(mockLedger[0]?.quantityChange).toBe('-5.000000');
    expect(mockLedger[0]?.stockValueChange).toBe('-500.0000');
    expect(mockLedger[0]?.stockValueAfter).toBe('4500.0000');

    // Posting Engine triggered with negative quantity for Expense/Loss posting
    expect(postingEngine.postStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        movementType: 'adjustment',
        quantity: '-5.000000',
        totalValue: '500.0000',
      }),
    );
  });

  it('2. Surplus / Excess Reconciliation: should increase on-hand, record ledger and trigger GL posting for gain', async () => {
    // Current onHand = 50 @ 100 EGP
    // Physical count found 55 sheets (Surplus of 5 sheets = +500 EGP Gain)
    const input: ReconcileStockInput = {
      itemId: mockItemId,
      warehouseId: mockWarehouseId,
      physicalQty: '55',
      note: 'جرد فعلي: زيادة 5 ألواح صاج',
    };

    const result = await inventoryService.reconcileStock(input);

    expect(result.previousQty).toBe('50.000000');
    expect(result.physicalQty).toBe('55.000000');
    expect(result.differenceQty).toBe('5.000000');
    expect(result.adjustmentType).toBe('surplus');

    // Balance updated
    expect(mockBalance?.onHand).toBe(55);
    expect(mockBalance?.totalValue).toBe(5500);

    // Ledger entry recorded with positive value change
    expect(mockLedger.length).toBe(1);
    expect(mockLedger[0]?.balanceQtyAfter).toBe('55.000000');
    expect(mockLedger[0]?.quantityChange).toBe('5.000000');
    expect(mockLedger[0]?.stockValueChange).toBe('500.0000');

    // Posting Engine triggered with positive quantity for Gain posting
    expect(postingEngine.postStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        movementType: 'adjustment',
        quantity: '5.000000',
        totalValue: '500.0000',
      }),
    );
  });

  it('3. Exact Match: should return none and not modify stock or create movements', async () => {
    const input: ReconcileStockInput = {
      itemId: mockItemId,
      warehouseId: mockWarehouseId,
      physicalQty: '50', // Exact match
    };

    const result = await inventoryService.reconcileStock(input);

    expect(result.adjustmentType).toBe('none');
    expect(result.differenceQty).toBe('0.000000');
    expect(mockMovements.length).toBe(0);
    expect(mockLedger.length).toBe(0);
    expect(postingEngine.postStockMovement).not.toHaveBeenCalled();
  });

  it('4. Validation: should reject negative physical quantity and non-existent warehouse', async () => {
    // Negative physical quantity
    await expect(
      inventoryService.reconcileStock({
        itemId: mockItemId,
        warehouseId: mockWarehouseId,
        physicalQty: '-10',
      }),
    ).rejects.toThrow(InventoryValidationError);

    // Non-existent warehouse
    await expect(
      inventoryService.reconcileStock({
        itemId: mockItemId,
        warehouseId: 'wh-non-existent',
        physicalQty: '10',
      }),
    ).rejects.toThrow(InventoryNotFoundError);
  });
});