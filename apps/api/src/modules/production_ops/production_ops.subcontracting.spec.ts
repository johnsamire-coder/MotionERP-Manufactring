import { ProductionOpsService } from './production_ops.service';
import { ProductionOpsRepository } from './production_ops.repository';
import { SalesService } from '../sales/sales.service';
import { TechnicalService } from '../technical/technical.service';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from '../accounting/accounting.service';
import { FinanceService } from '../finance/finance.service';
import { ProductionOpsValidationError } from './production_ops.errors';
import type {
  SubcontractingOrderRecord,
  CreateSubcontractingOrderInput,
} from './production_ops.types';
import type { CompanyAccountingConfigRecord } from '../accounting/accounting.types';

describe('ProductionOpsService — Subcontracting & Outsourced Operations Engine', () => {
  let productionOpsService: ProductionOpsService;
  let productionOpsRepo: ProductionOpsRepository;
  let salesService: SalesService;
  let technicalService: TechnicalService;
  let inventoryService: InventoryService;
  let accountingService: AccountingService;
  let financeService: FinanceService;

  const mockOrgNodeId = 'org-medical-factory-1';
  const mockSupplierId = 'sup-electrostatic-painter-1';
  const mockSubWarehouseId = 'wh-subcontractor-custody';
  const mockRawItemId = 'item-unpainted-sheet-60';
  const mockWipAccountId = 'acc-wip-manufacturing';
  const mockServiceLiabilityAccountId = 'acc-subcontractor-accrued-service';

  // Mock In-Memory State
  const mockOrders: Map<string, SubcontractingOrderRecord> = new Map();
  const mockPostedJournals: any[] = [];
  const mockStockMovements: any[] = [];

  beforeEach(() => {
    mockOrders.clear();
    mockPostedJournals.length = 0;
    mockStockMovements.length = 0;

    productionOpsRepo = {
      countSubcontractingOrders: jest.fn().mockImplementation(async () => mockOrders.size),
      insertSubcontractingOrder: jest.fn().mockImplementation(async (input) => {
        const record: SubcontractingOrderRecord = {
          id: input.id,
          voucherNumber: input.voucherNumber,
          orgNodeId: input.orgNodeId,
          supplierId: input.supplierId,
          workOrderId: input.workOrderId ?? null,
          postingDate: input.postingDate ?? new Date().toISOString(),
          totalServiceCost: input.totalServiceCost,
          serviceAccountId: input.serviceAccountId,
          status: 'draft',
          purchaseInvoiceId: null,
          notes: input.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: input.computedItems.map((item: any) => ({
            ...item,
            subcontractingOrderId: input.id,
            receivedQty: '0',
            createdAt: new Date().toISOString(),
          })),
        };
        mockOrders.set(input.id, record);
        return record;
      }),
      findSubcontractingOrderById: jest.fn().mockImplementation(async (id: string) => {
        return mockOrders.get(id) ?? null;
      }),
      addSubcontractingReceived: jest
        .fn()
        .mockImplementation(async (lineId: string, qty: string) => {
          for (const o of mockOrders.values())
            for (const i of o.items)
              if (i.id === lineId) i.receivedQty = String(Number(i.receivedQty) + Number(qty));
        }),
      findSubcontractingOrderIdByInvoice: jest
        .fn()
        .mockImplementation(
          async (invoiceId: string) =>
            [...mockOrders.values()].find((o) => o.purchaseInvoiceId === invoiceId)?.id ?? null,
        ),
      setSubcontractingInvoice: jest
        .fn()
        .mockImplementation(async (id: string, invoiceId: string) => {
          mockOrders.get(id)!.purchaseInvoiceId = invoiceId;
        }),
      setSubcontractingOrderStatus: jest
        .fn()
        .mockImplementation(async (id: string, status: any) => {
          const o = mockOrders.get(id);
          if (o) {
            o.status = status;
            o.updatedAt = new Date().toISOString();
          }
          return o;
        }),
    } as unknown as ProductionOpsRepository;

    salesService = {} as unknown as SalesService;
    technicalService = {} as unknown as TechnicalService;

    inventoryService = {
      createMovement: jest.fn().mockImplementation(async (input) => {
        mockStockMovements.push(input);
        return input;
      }),
    } as unknown as InventoryService;

    accountingService = {
      getCompanyConfig: jest.fn().mockResolvedValue({
        orgNodeId: mockOrgNodeId,
        defaultWipAccountId: mockWipAccountId,
      } as CompanyAccountingConfigRecord),
      createEntry: jest.fn().mockImplementation(async (input) => {
        const je = {
          id: `je-sub-${mockPostedJournals.length + 1}`,
          entryNumber: `JE-SUB-00${mockPostedJournals.length + 1}`,
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

    financeService = {
      getPurchaseInvoice: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'pinv-other') return { id, supplierId: 'someone-else', status: 'posted' };
        if (id === 'pinv-1') return { id, supplierId: mockSupplierId, status: 'posted' };
        throw new Error('not found');
      }),
    } as unknown as FinanceService;

    productionOpsService = new ProductionOpsService(
      productionOpsRepo,
      salesService,
      technicalService,
      inventoryService,
      accountingService,
      financeService,
    );
  });

  it('1. Create Subcontracting Order: should compute merged valuation rate [(5000/50) + 20 = 120 EGP/unit]', async () => {
    const input: CreateSubcontractingOrderInput = {
      orgNodeId: mockOrgNodeId,
      supplierId: mockSupplierId,
      workOrderId: 'wo-100',
      totalServiceCost: '1000.0000', // 50 units * 20 EGP painting service = 1,000 EGP
      serviceAccountId: mockServiceLiabilityAccountId,
      notes: 'أمر تشغيل خارجي: دهان إلكتروستاتيك لوحدات الأدراج',
      items: [
        {
          itemId: mockRawItemId,
          warehouseId: mockSubWarehouseId,
          quantity: '50.000000',
          rawMaterialCost: '5000.0000', // 100 EGP per raw unit
          serviceRate: '20.0000', // 20 EGP service fee per unit
        },
      ],
    };

    const order = await productionOpsService.createSubcontractingOrder(input);

    expect(order.voucherNumber).toBe('SUB-WO-2026-000001');
    expect(order.totalServiceCost).toBe('1000.0000');
    expect(order.status).toBe('draft');
    expect(order.items.length).toBe(1);

    const item = order.items[0]!;
    // (5000 / 50) + 20 = 120 EGP/unit
    expect(item.newValuationRate).toBe('120.000000');
  });

  it('2. Post Subcontracting Order: should post [Dr WIP / Cr Service Liability] and issue raw materials from custody', async () => {
    const order = await productionOpsService.createSubcontractingOrder({
      orgNodeId: mockOrgNodeId,
      supplierId: mockSupplierId,
      totalServiceCost: '1000.0000',
      serviceAccountId: mockServiceLiabilityAccountId,
      items: [
        {
          itemId: mockRawItemId,
          warehouseId: mockSubWarehouseId,
          quantity: '50.000000',
          rawMaterialCost: '5000.0000',
          serviceRate: '20.0000',
        },
      ],
    });

    const postedOrder = await productionOpsService.postSubcontractingOrder(order.id);

    expect(postedOrder.status).toBe('posted');

    // Verify WIP Capitalization Journal Entry: [Dr WIP (1000) / Cr Accrued Service Liability (1000)]
    expect(accountingService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orgNodeId: mockOrgNodeId,
        isAutoGenerated: true,
        sourceEventType: 'subcontracting',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountId: mockWipAccountId,
            debitAmount: '1000.0000',
            creditAmount: '0',
          }),
          expect.objectContaining({
            accountId: mockServiceLiabilityAccountId,
            debitAmount: '0',
            creditAmount: '1000.0000',
          }),
        ]),
      }),
    );
    expect(accountingService.postEntry).toHaveBeenCalledTimes(1);

    // Verify raw materials were issued from subcontractor warehouse
    expect(inventoryService.createMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: mockRawItemId,
        warehouseId: mockSubWarehouseId,
        movementType: 'issue',
        quantity: '50.000000',
      }),
    );
  });

  it('3. Security & Validation: should reject order with empty items or non-positive service cost', async () => {
    await expect(
      productionOpsService.createSubcontractingOrder({
        orgNodeId: mockOrgNodeId,
        supplierId: mockSupplierId,
        totalServiceCost: '0',
        serviceAccountId: mockServiceLiabilityAccountId,
        items: [],
      }),
    ).rejects.toThrow(ProductionOpsValidationError);

    await expect(
      productionOpsService.createSubcontractingOrder({
        orgNodeId: mockOrgNodeId,
        supplierId: mockSupplierId,
        totalServiceCost: '500',
        serviceAccountId: mockServiceLiabilityAccountId,
        items: [],
      }),
    ).rejects.toThrow(ProductionOpsValidationError);
  });

  async function postedOrder(): Promise<SubcontractingOrderRecord> {
    const order = await productionOpsService.createSubcontractingOrder({
      orgNodeId: mockOrgNodeId,
      supplierId: mockSupplierId,
      totalServiceCost: '1000.0000',
      serviceAccountId: mockServiceLiabilityAccountId,
      items: [
        {
          itemId: mockRawItemId,
          warehouseId: mockSubWarehouseId,
          quantity: '50.000000',
          rawMaterialCost: '5000.0000',
          serviceRate: '20.0000',
        },
      ],
    });
    return productionOpsService.postSubcontractingOrder(order.id);
  }

  it('4. Receive (plan item 45): partial then the rest, at the merged rate, as a production receipt', async () => {
    const order = await postedOrder();
    const line = order.items[0]!;
    mockStockMovements.length = 0;

    const partial = await productionOpsService.receiveSubcontractingOrder(order.id, {
      warehouseId: 'wh-finished',
      lines: [{ subcontractingItemId: line.id, quantity: '20' }],
    });
    expect(partial.status).toBe('partially_received');
    expect(mockStockMovements[0]).toEqual(
      expect.objectContaining({
        itemId: mockRawItemId,
        warehouseId: 'wh-finished',
        movementType: 'receipt',
        quantity: '20',
        unitCost: '120.000000',
        sourceModule: 'production',
      }),
    );

    await expect(
      productionOpsService.receiveSubcontractingOrder(order.id, {
        warehouseId: 'wh-finished',
        lines: [{ subcontractingItemId: line.id, quantity: '31' }],
      }),
    ).rejects.toThrow('only 30 left');

    const done = await productionOpsService.receiveSubcontractingOrder(order.id, {
      warehouseId: 'wh-finished',
    });
    expect(done.status).toBe('completed');
    expect(mockStockMovements[1]).toEqual(expect.objectContaining({ quantity: '30' }));
    await expect(
      productionOpsService.receiveSubcontractingOrder(order.id, { warehouseId: 'wh-finished' }),
    ).rejects.toThrow('only a posted order');
    await expect(productionOpsService.cancelSubcontractingOrder(order.id)).rejects.toThrow(
      ProductionOpsValidationError,
    );
  });

  it('5. Receive: a draft order cannot be received', async () => {
    const draft = await productionOpsService.createSubcontractingOrder({
      orgNodeId: mockOrgNodeId,
      supplierId: mockSupplierId,
      totalServiceCost: '100',
      serviceAccountId: mockServiceLiabilityAccountId,
      items: [
        {
          itemId: mockRawItemId,
          warehouseId: mockSubWarehouseId,
          quantity: '5',
          rawMaterialCost: '50',
          serviceRate: '20',
        },
      ],
    });
    await expect(
      productionOpsService.receiveSubcontractingOrder(draft.id, { warehouseId: 'wh' }),
    ).rejects.toThrow(ProductionOpsValidationError);
  });

  it('6. Invoice link (plan item 45): same supplier only, one order per invoice', async () => {
    const order = await postedOrder();
    await expect(
      productionOpsService.linkSubcontractingInvoice(order.id, 'pinv-other'),
    ).rejects.toThrow('another supplier');
    await expect(
      productionOpsService.linkSubcontractingInvoice(order.id, 'pinv-missing'),
    ).rejects.toThrow('does not exist');
    const linked = await productionOpsService.linkSubcontractingInvoice(order.id, 'pinv-1');
    expect(linked.purchaseInvoiceId).toBe('pinv-1');
    const second = await postedOrder();
    await expect(
      productionOpsService.linkSubcontractingInvoice(second.id, 'pinv-1'),
    ).rejects.toThrow('already linked');
  });
});
