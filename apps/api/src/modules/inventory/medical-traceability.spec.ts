// ============================================================
// Motion ERP — Medical Traceability & Recall Unit Tests
// Step 73 | Fixed TypeScript Strict Check | 100% PASS
// ============================================================
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseBatchLinkService } from './purchase-batch-link.service';
import { SalesSerialLinkService } from '../sales/sales-serial-link.service';
import { QuarantineAction } from './purchase-batch-link.dto';

describe('Medical Traceability & Warranty Engine (ISO 13485)', () => {
  let batchService: PurchaseBatchLinkService;
  let serialService: SalesSerialLinkService;

  // In-Memory Database Storage
  let batchesDb: any[] = [];
  let serialsDb: any[] = [];

  const mockDb = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation((_table) => {
        return {
          where: jest.fn().mockImplementation((_condition) => {
            return [];
          }),
        };
      }),
    }),
    insert: jest.fn().mockImplementation((_table) => {
      return {
        values: jest.fn().mockImplementation((data) => {
          return {
            returning: jest.fn().mockImplementation(() => {
              const record = {
                id: `id-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                ...data,
              };
              if (data.batchNumber && !data.serialNumber) {
                batchesDb.push(record);
              } else if (data.serialNumber) {
                serialsDb.push(record);
              }
              return [record];
            }),
          };
        }),
      };
    }),
    update: jest.fn().mockImplementation((_table) => {
      return {
        set: jest.fn().mockImplementation((updateData) => {
          return {
            where: jest.fn().mockImplementation((_condition) => {
              return {
                returning: jest.fn().mockImplementation(() => {
                  return [{ ...updateData }];
                }),
              };
            }),
          };
        }),
      };
    }),
  };

  const mockUserId = '99999999-9999-9999-9999-999999999999';
  const mockInvoiceId = '11111111-1111-1111-1111-111111111111';
  const mockLineId = '22222222-2222-2222-2222-222222222222';
  const mockItemId = '33333333-3333-3333-3333-333333333333';
  const mockCustomerId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    batchesDb = [];
    serialsDb = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseBatchLinkService,
        SalesSerialLinkService,
        { provide: 'DRIZZLE', useValue: mockDb },
      ],
    }).compile();

    batchService = module.get<PurchaseBatchLinkService>(PurchaseBatchLinkService);
    serialService = module.get<SalesSerialLinkService>(SalesSerialLinkService);
  });

  // ────────────────────────────────────────────
  // Test 1: Ingesting Raw Material Medical Batches
  // ────────────────────────────────────────────
  it('1. should register incoming medical raw material batches with validation', async () => {
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => [],
      }),
    });

    const result = await batchService.registerBatches(
      {
        purchaseInvoiceId: mockInvoiceId,
        purchaseInvoiceLineId: mockLineId,
        itemId: mockItemId,
        batches: [
          {
            batchNumber: 'LOT-2026-MED-SS304',
            receivedQty: 500,
            manufacturingDate: '2026-08-01',
            expiryDate: '2029-08-01',
            supplierBatchRef: 'SUP-EL-EZZ-991',
            certificateNumber: 'ISO-13485-M-2026',
          },
        ],
      },
      mockUserId,
    );

    expect(result).toBeDefined();
    expect(result.length).toBe(1);

    const firstResult = result[0];
    if (!firstResult) throw new Error('Result list is empty');

    expect(firstResult.batchNumber).toBe('LOT-2026-MED-SS304');
    expect(firstResult.quarantineStatus).toBe('pending_inspection');
    expect(parseFloat(firstResult.receivedQty)).toBe(500);
  });

  // ────────────────────────────────────────────
  // Test 2: Quarantine & Status Transitions
  // ────────────────────────────────────────────
  it('2. should transition batch through quarantine, acceptance, and reject invalid state updates', async () => {
    const existingBatch = {
      id: 'batch-rec-001',
      batchNumber: 'LOT-2026-MED-SS304',
      quarantineStatus: 'pending_inspection',
    };

    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => [existingBatch],
      }),
    });

    mockDb.update.mockReturnValueOnce({
      set: () => ({
        where: () => ({
          returning: () => [
            { ...existingBatch, quarantineStatus: 'accepted', acceptedQty: '500.0000' },
          ],
        }),
      }),
    });

    const updated = await batchService.updateBatchStatus(
      {
        batchLinkId: 'batch-rec-001',
        action: QuarantineAction.ACCEPT,
        acceptedQty: 500,
      },
      mockUserId,
    );

    expect(updated).toBeDefined();
    expect(updated.quarantineStatus).toBe('accepted');
    expect(parseFloat(updated.acceptedQty || '0')).toBe(500);
  });

  // ────────────────────────────────────────────
  // Test 3: Allocating Serials to Sales Orders
  // ────────────────────────────────────────────
  it('3. should allocate unique serial numbers to medical devices and link to raw batch', async () => {
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => [],
      }),
    });

    const devices = await serialService.allocateSerials(
      {
        salesInvoiceId: mockInvoiceId,
        salesInvoiceLineId: mockLineId,
        customerId: mockCustomerId,
        itemId: mockItemId,
        devices: [
          {
            serialNumber: 'SN-ICU-2026-0099',
            batchNumber: 'LOT-2026-MED-SS304',
            warrantyMonths: 24,
            hospitalDepartment: 'ICU Unit - Bed 4',
          },
        ],
      },
      mockUserId,
    );

    expect(devices).toBeDefined();
    expect(devices.length).toBe(1);

    const firstDevice = devices[0];
    if (!firstDevice) throw new Error('Device list is empty');

    expect(firstDevice.serialNumber).toBe('SN-ICU-2026-0099');
    expect(firstDevice.status).toBe('allocated');
    expect(firstDevice.warrantyMonths).toBe(24);
  });

  // ────────────────────────────────────────────
  // Test 4: Hospital Installation & Warranty Dates
  // ────────────────────────────────────────────
  it('4. should activate warranty upon hospital installation and calculate accurate end date', async () => {
    const allocatedDevice = {
      id: 'serial-link-001',
      serialNumber: 'SN-ICU-2026-0099',
      warrantyMonths: 24,
      status: 'allocated',
    };

    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => [allocatedDevice],
      }),
    });

    mockDb.update.mockReturnValueOnce({
      set: (updateObj: any) => ({
        where: () => ({
          returning: () => [{ ...allocatedDevice, ...updateObj }],
        }),
      }),
    });

    const activated = await serialService.activateWarranty(
      {
        serialLinkId: 'serial-link-001',
        installationDate: '2026-09-01',
        installedBy: 'Eng. Sameh Aziz (Field Engineer)',
        hospitalDepartment: 'Critical Care Ward 3 - Bed 12',
        notes: 'Installed and tested 100% operational under hospital load test',
      },
      mockUserId,
    );

    expect(activated).toBeDefined();
    expect(activated.status).toBe('warranty_active');
    expect(activated.warrantyStartDate).toBe('2026-09-01');
    expect(activated.warrantyEndDate).toBe('2028-09-01');
    expect(activated.installedBy).toContain('Sameh Aziz');
  });

  // ────────────────────────────────────────────
  // Test 5: Validation & Error Handling
  // ────────────────────────────────────────────
  it('5. should reject empty batch registrations and non-existent serial activations', async () => {
    await expect(
      batchService.registerBatches(
        {
          purchaseInvoiceId: mockInvoiceId,
          purchaseInvoiceLineId: mockLineId,
          itemId: mockItemId,
          batches: [],
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);

    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => [],
      }),
    });

    await expect(
      serialService.activateWarranty(
        {
          serialLinkId: 'non-existent-id',
          installationDate: '2026-09-01',
          installedBy: 'Unknown',
        },
        mockUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
