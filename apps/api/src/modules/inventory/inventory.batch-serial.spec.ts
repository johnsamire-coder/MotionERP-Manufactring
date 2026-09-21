import { InventoryService } from './inventory.service';
import { InventoryRepository } from './inventory.repository';
import { InventoryValidationError, InventoryNotFoundError } from './inventory.errors';
import type {
  ItemBatchRecord,
  CreateItemBatchInput,
  SerialNumberRecord,
  CreateSerialNumberInput,
} from './inventory.types';

describe('InventoryService — Medical Batch, Lot & Serial Tracking', () => {
  let inventoryService: InventoryService;
  let inventoryRepo: InventoryRepository;

  // Mock In-Memory State
  const mockBatches: Map<string, ItemBatchRecord> = new Map();
  const mockSerials: Map<string, SerialNumberRecord> = new Map();

  const mockOrgNodeId = 'org-medical-factory-1';
  const mockRawItemId = 'item-steel-sheet-60';
  const mockFgItemId = 'item-medical-cabinet-60';
  const mockWarehouseId = 'wh-main-store';

  beforeEach(() => {
    mockBatches.clear();
    mockSerials.clear();

    inventoryRepo = {
      findBatchByNumber: jest.fn().mockImplementation(async (itemId: string, batchNo: string) => {
        return Array.from(mockBatches.values()).find((b) => b.itemId === itemId && b.batchNumber === batchNo) ?? null;
      }),
      findBatchById: jest.fn().mockImplementation(async (id: string) => {
        return mockBatches.get(id) ?? null;
      }),
      listBatches: jest.fn().mockImplementation(async () => Array.from(mockBatches.values())),
      insertBatch: jest.fn().mockImplementation(async (input: CreateItemBatchInput & { id: string }) => {
        const record: ItemBatchRecord = {
          id: input.id,
          batchNumber: input.batchNumber,
          itemId: input.itemId,
          orgNodeId: input.orgNodeId,
          manufacturingDate: input.manufacturingDate ?? null,
          expiryDate: input.expiryDate ?? null,
          status: 'active',
          notes: input.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockBatches.set(input.id, record);
        return record;
      }),
      setBatchStatus: jest.fn().mockImplementation(async (id: string, status: any) => {
        const b = mockBatches.get(id);
        if (b) {
          b.status = status;
          b.updatedAt = new Date().toISOString();
        }
        return b;
      }),

      findSerialByNo: jest.fn().mockImplementation(async (itemId: string, serialNo: string) => {
        return Array.from(mockSerials.values()).find((s) => s.itemId === itemId && s.serialNo === serialNo) ?? null;
      }),
      findSerialById: jest.fn().mockImplementation(async (id: string) => {
        return mockSerials.get(id) ?? null;
      }),
      listSerials: jest.fn().mockImplementation(async () => Array.from(mockSerials.values())),
      insertSerial: jest.fn().mockImplementation(async (input: CreateSerialNumberInput & { id: string }) => {
        const record: SerialNumberRecord = {
          id: input.id,
          serialNo: input.serialNo,
          itemId: input.itemId,
          warehouseId: input.warehouseId ?? null,
          batchId: input.batchId ?? null,
          orgNodeId: input.orgNodeId,
          status: 'active',
          purchaseReceiptId: input.purchaseReceiptId ?? null,
          deliveryOrderId: null,
          workOrderId: input.workOrderId ?? null,
          notes: input.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockSerials.set(input.id, record);
        return record;
      }),
      setSerialStatus: jest.fn().mockImplementation(async (id: string, status: any, whId?: string, dnId?: string) => {
        const s = mockSerials.get(id);
        if (s) {
          s.status = status;
          if (whId !== undefined) s.warehouseId = whId;
          if (dnId !== undefined) s.deliveryOrderId = dnId;
          s.updatedAt = new Date().toISOString();
        }
        return s;
      }),
    } as unknown as InventoryRepository;

    inventoryService = new InventoryService(inventoryRepo);
  });

  it('1. Create Medical Batch: should register batch with mfg and expiry dates', async () => {
    const input: CreateItemBatchInput = {
      batchNumber: 'LOT-2026-STEEL-001',
      itemId: mockRawItemId,
      orgNodeId: mockOrgNodeId,
      manufacturingDate: '2026-01-10',
      expiryDate: '2028-01-10',
      notes: 'لوط صاج مجلفن طبي معقم',
    };

    const batch = await inventoryService.createBatch(input);

    expect(batch.batchNumber).toBe('LOT-2026-STEEL-001');
    expect(batch.status).toBe('active');
    expect(batch.expiryDate).toBe('2028-01-10');
    expect(batch.notes).toBe('لوط صاج مجلفن طبي معقم');
  });

  it('2. Validation: should prevent duplicate batch number for the same item', async () => {
    await inventoryService.createBatch({
      batchNumber: 'LOT-UNIQUE-001',
      itemId: mockRawItemId,
      orgNodeId: mockOrgNodeId,
    });

    await expect(
      inventoryService.createBatch({
        batchNumber: 'LOT-UNIQUE-001',
        itemId: mockRawItemId,
        orgNodeId: mockOrgNodeId,
      }),
    ).rejects.toThrow(InventoryValidationError);
  });

  it('3. Quarantine & Medical Recall: should allow changing batch status to quarantined and recalled', async () => {
    const batch = await inventoryService.createBatch({
      batchNumber: 'LOT-DEFECT-001',
      itemId: mockRawItemId,
      orgNodeId: mockOrgNodeId,
    });

    // Place in Quarantine
    const quarantined = await inventoryService.setBatchStatus(batch.id, 'quarantined');
    expect(quarantined.status).toBe('quarantined');

    // Issue Medical Recall
    const recalled = await inventoryService.setBatchStatus(batch.id, 'recalled');
    expect(recalled.status).toBe('recalled');
  });

  it('4. Bulk Serial Generation: should generate multiple serials for manufactured medical devices', async () => {
    const serialNumbers = ['SN-CAB-001', 'SN-CAB-002', 'SN-CAB-003'];

    const serials = await inventoryService.createSerialNumbersBulk(
      mockFgItemId,
      mockOrgNodeId,
      serialNumbers,
      mockWarehouseId,
    );

    expect(serials.length).toBe(3);
    expect(serials[0]?.serialNo).toBe('SN-CAB-001');
    expect(serials[1]?.serialNo).toBe('SN-CAB-002');
    expect(serials[2]?.serialNo).toBe('SN-CAB-003');
    expect(serials[0]?.warehouseId).toBe(mockWarehouseId);
    expect(serials[0]?.status).toBe('active');
  });

  it('5. Serial Lifecycle: should update status to delivered when shipped to hospital', async () => {
    const serial = await inventoryService.createSerialNumber({
      serialNo: 'SN-HOSP-9988',
      itemId: mockFgItemId,
      orgNodeId: mockOrgNodeId,
      warehouseId: mockWarehouseId,
    });

    expect(serial.status).toBe('active');

    // Deliver to hospital
    const delivered = await inventoryService.setSerialStatus(serial.id, 'delivered', undefined, 'dn-hospital-001');

    expect(delivered.status).toBe('delivered');
    expect(delivered.deliveryOrderId).toBe('dn-hospital-001');
  });
});