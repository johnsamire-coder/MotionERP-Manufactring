import { AccountingService } from './accounting.service';
import { AccountingRepository } from './accounting.repository';
import { PostingEngineService } from './posting-engine.service';
import { FinanceService } from '../finance/finance.service';
import { FinanceRepository } from '../finance/finance.repository';
import { SalesService } from '../sales/sales.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryRepository } from '../inventory/inventory.repository';
import { QualityService } from '../quality/quality.service';
import { QualityRepository } from '../quality/quality.repository';
import { CostService } from '../cost/cost.service';
import { CostRepository } from '../cost/cost.repository';

describe('Motion ERP — Grand Milestone 50: Complete End-to-End Operational & Financial Cycle', () => {
  // Services
  let accountingService: AccountingService;
  let accountingRepo: AccountingRepository;
  let postingEngine: PostingEngineService;
  let financeService: FinanceService;
  let financeRepo: FinanceRepository;
  let salesService: SalesService;
  let inventoryService: InventoryService;
  let inventoryRepo: InventoryRepository;
  let qualityService: QualityService;
  let qualityRepo: QualityRepository;
  let costService: CostService;
  let costRepo: CostRepository;

  // Master IDs
  const orgNodeId = 'org-medical-factory-egypt';
  const supplierId = 'sup-steel-egypt';
  const customerId = 'cust-cairo-hospital';
  const rawWarehouseId = 'wh-raw-materials';
  const fgWarehouseId = 'wh-finished-goods';

  const rawItemId = 'item-galvanized-sheet-1.2mm';
  const fgItemId = 'item-medical-cabinet-60';

  // Accounts
  const rawInvAccount = '1201-raw-inventory';
  const fgInvAccount = '1202-fg-inventory';
  const grniAccount = '2105-grni-clearing';
  const wipAccount = '1203-wip-manufacturing';
  const cogsAccount = '5101-cost-of-goods-sold';
  const apAccount = '2101-accounts-payable';
  const arAccount = '1102-accounts-receivable';
  const bankAccount = '1101-bank-cib-egp';
  const revenueAccount = '4101-sales-revenue';
  const inputVatAccount = '1401-input-vat-14';
  const outputVatAccount = '2401-output-vat-14';
  const taxAuthorityAccount = '2402-tax-authority-payable';

  // State
  const journals: any[] = [];
  let journalSeq = 0;
  const balances: Map<string, { onHand: number; averageCost: number; totalValue: number; reserved: number }> = new Map();
  const invoices: Map<string, any> = new Map();
  const batches: Map<string, any> = new Map();
  const serials: Map<string, any> = new Map();
  const inspections: Map<string, any> = new Map();

  beforeEach(() => {
    journals.length = 0;
    journalSeq = 0;
    balances.clear();
    invoices.clear();
    batches.clear();
    serials.clear();
    inspections.clear();

    // 1. Accounting Repo Mock
    accountingRepo = {
      findCompanyConfig: jest.fn().mockResolvedValue({
        orgNodeId,
        defaultGrniAccountId: grniAccount,
        defaultWipAccountId: wipAccount,
        defaultCogsAccountId: cogsAccount,
        defaultPayableAccountId: apAccount,
        defaultReceivableAccountId: arAccount,
        defaultInputTaxAccountId: inputVatAccount,
        defaultOutputTaxAccountId: outputVatAccount,
      }),
      listAccountDeterminations: jest.fn().mockResolvedValue([
        { orgNodeId, determinationType: 'warehouse', referenceId: rawWarehouseId, accountPurpose: 'inventory', accountId: rawInvAccount },
        { orgNodeId, determinationType: 'warehouse', referenceId: fgWarehouseId, accountPurpose: 'inventory', accountId: fgInvAccount },
        { orgNodeId, accountPurpose: 'purchase', accountId: grniAccount },
        { orgNodeId, accountPurpose: 'wip', accountId: wipAccount },
        { orgNodeId, accountPurpose: 'cogs', accountId: cogsAccount },
        { orgNodeId, accountPurpose: 'payable', accountId: apAccount },
        { orgNodeId, accountPurpose: 'receivable', accountId: arAccount },
        { orgNodeId, accountPurpose: 'revenue', accountId: revenueAccount },
        { orgNodeId, accountPurpose: 'input_tax', accountId: inputVatAccount },
        { orgNodeId, accountPurpose: 'output_tax', accountId: outputVatAccount },
      ]),
      findFiscalYearByDate: jest.fn().mockResolvedValue(null),
      findAccountById: jest.fn().mockResolvedValue({ id: 'acc-ok', isLeaf: true, orgNodeId }),
      countEntries: jest.fn().mockImplementation(async () => journalSeq),
      findEntryByIdempotencyKey: jest.fn().mockResolvedValue(null),
      findEntryById: jest.fn().mockImplementation(async (id: string) => {
        return journals.find((j) => j.id === id) ?? null;
      }),
      insertEntry: jest.fn().mockImplementation(async (input) => {
        journalSeq++;
        const entry = {
          id: `je-${journalSeq}`,
          entryNumber: `JE-2026-${String(journalSeq).padStart(5, '0')}`,
          orgNodeId: input.orgNodeId,
          description: input.description,
          entryDate: new Date(input.entryDate ?? Date.now()),
          status: 'draft',
          lines: input.lines.map((l: any, idx: number) => ({
            id: `jl-${idx + 1}`,
            accountId: l.accountId,
            debitAmount: l.debitAmount ?? '0',
            creditAmount: l.creditAmount ?? '0',
            description: l.description,
            partyType: l.partyType ?? null,
            partyId: l.partyId ?? null,
          })),
        };
        journals.push(entry);
        return entry;
      }),
      setEntryStatus: jest.fn().mockImplementation(async (id: string, status: any) => {
        const found = journals.find((j) => j.id === id);
        if (found) found.status = status;
        return found;
      }),
      listEntryIdsBySourceForCompany: jest.fn().mockResolvedValue([]),
      listAllPostedLinesWithDetails: jest.fn().mockImplementation(async () => {
        const lines: any[] = [];
        for (const j of journals.filter((e) => e.status === 'posted')) {
          for (const l of j.lines) {
            let typeCode = 'asset';
            if (l.accountId === apAccount || l.accountId === grniAccount || l.accountId === outputVatAccount || l.accountId === taxAuthorityAccount) typeCode = 'liability';
            if (l.accountId === revenueAccount) typeCode = 'revenue';
            if (l.accountId === cogsAccount) typeCode = 'cogs';
            if (l.accountId === wipAccount) typeCode = 'wip';

            lines.push({
              accountId: l.accountId,
              code: l.accountId.split('-')[0],
              name: l.accountId,
              typeCode,
              normalBalance: typeCode === 'liability' || typeCode === 'revenue' ? 'credit' : 'debit',
              debit: l.debitAmount,
              credit: l.creditAmount,
              entryDate: j.entryDate,
              partyType: l.partyType,
              partyId: l.partyId,
              journalEntryId: j.id,
              entryNumber: j.entryNumber,
              description: l.description,
            });
          }
        }
        return lines;
      }),
    } as unknown as AccountingRepository;

    accountingService = new AccountingService(accountingRepo);
    postingEngine = new PostingEngineService(accountingRepo, accountingService);

    // 2. Inventory Repo Mock
    inventoryRepo = {
      findWarehouseById: jest.fn().mockImplementation(async (whId) => ({ id: whId, orgNodeId })),
      findBalance: jest.fn().mockImplementation(async (itemId, whId) => {
        const key = `${itemId}-${whId}`;
        const cur = balances.get(key) ?? { onHand: 0, averageCost: 0, totalValue: 0, reserved: 0 };
        return {
          id: `bal-${key}`,
          itemId,
          warehouseId: whId,
          onHand: String(cur.onHand),
          reserved: String(cur.reserved),
          averageCost: String(cur.averageCost),
          totalValue: String(cur.totalValue),
        };
      }),
      insertMovement: jest.fn().mockImplementation(async (input) => input),
      findLatestMovementDate: jest.fn().mockResolvedValue(null),
      applyDelta: jest.fn().mockImplementation(async (itemId, whId, delta) => {
        const key = `${itemId}-${whId}`;
        const cur = balances.get(key) ?? { onHand: 0, averageCost: 0, totalValue: 0, reserved: 0 };
        cur.onHand += Number(delta);
        balances.set(key, cur);
      }),
      applyValuation: jest.fn().mockImplementation(async (itemId, whId, v) => {
        const key = `${itemId}-${whId}`;
        const cur = balances.get(key) ?? { onHand: 0, averageCost: 0, totalValue: 0, reserved: 0 };
        cur.averageCost = Number(v.averageCost);
        cur.totalValue = Number(v.totalValue);
        balances.set(key, cur);
      }),
      insertLedgerEntry: jest.fn().mockImplementation(async (input) => input),
      insertBatch: jest.fn().mockImplementation(async (input) => {
        batches.set(input.id, input);
        return input;
      }),
      findBatchById: jest.fn().mockImplementation(async (id) => batches.get(id)),
      findBatchByNumber: jest.fn().mockResolvedValue(null),
      insertSerial: jest.fn().mockImplementation(async (input) => {
        serials.set(input.id, input);
        return input;
      }),
      findSerialByNo: jest.fn().mockResolvedValue(null),
    } as unknown as InventoryRepository;

    inventoryService = new InventoryService(inventoryRepo, postingEngine);

    // 3. Finance Repo Mock
    financeRepo = {
      countPurchaseInvoices: jest.fn().mockImplementation(async () => invoices.size),
      findPurchaseInvoiceBySupplierNumber: jest.fn().mockResolvedValue(null),
      insertPurchaseInvoice: jest.fn().mockImplementation(async (input) => {
        invoices.set(input.id, { ...input, status: 'draft' });
        return { ...input, status: 'draft' };
      }),
      findPurchaseInvoiceById: jest.fn().mockImplementation(async (id) => invoices.get(id)),
      setPurchaseInvoiceStatus: jest.fn().mockImplementation(async (id, status) => {
        const inv = invoices.get(id);
        if (inv) inv.status = status;
        return inv;
      }),
      countSalesInvoices: jest.fn().mockImplementation(async () => invoices.size),
      insertSalesInvoice: jest.fn().mockImplementation(async (input) => {
        invoices.set(input.id, { ...input, status: 'draft' });
        return { ...input, status: 'draft' };
      }),
      findSalesInvoiceById: jest.fn().mockImplementation(async (id) => invoices.get(id)),
      setSalesInvoiceStatus: jest.fn().mockImplementation(async (id, status) => {
        const inv = invoices.get(id);
        if (inv) inv.status = status;
        return inv;
      }),
      countPayments: jest.fn().mockResolvedValue(1),
      insertPayment: jest.fn().mockImplementation(async (input) => input),
      findPaymentById: jest.fn().mockImplementation(async (id) => ({
        id,
        orgNodeId,
        supplierId,
        amount: '5700.0000',
        paidFromAccountId: bankAccount,
        status: 'draft',
        paymentNumber: 'PAY-001',
      })),
      setPaymentStatus: jest.fn().mockImplementation(async (id, status) => ({ id, status })),
      countCollections: jest.fn().mockResolvedValue(1),
      insertCollection: jest.fn().mockImplementation(async (input) => input),
    } as unknown as FinanceRepository;

    salesService = {
      getJobOrders: jest.fn().mockResolvedValue([
        { id: 'jo-100', jobOrderNumber: 'JO-2026-MED-001', orgNodeId, customerId },
      ]),
    } as unknown as SalesService;

    financeService = new FinanceService(financeRepo, salesService, accountingService, accountingRepo);

    // 4. Quality Repo Mock
    qualityRepo = {
      countInspections: jest.fn().mockImplementation(async () => inspections.size),
      insertInspection: jest.fn().mockImplementation(async (input) => {
        inspections.set(input.id, { ...input, status: 'pending' });
        return { ...input, status: 'pending' };
      }),
      findInspectionById: jest.fn().mockImplementation(async (id) => inspections.get(id)),
      updateInspectionStatus: jest.fn().mockImplementation(async (id, status) => {
        const insp = inspections.get(id);
        if (insp) insp.status = status;
        return insp;
      }),
    } as unknown as QualityRepository;

    qualityService = new QualityService(qualityRepo);
  });

  it('Master Cycle: From Raw Material Purchase & Batch Tracking to Production, Sales, VAT Settlement & Final Reports', async () => {
    // ==========================================
    // STEP 1: Register Medical Batch & Receive Raw Material (Sheet Metal)
    // ==========================================
    const batch = await inventoryService.createBatch({
      batchNumber: 'LOT-2026-MED-01',
      itemId: rawItemId,
      orgNodeId,
      manufacturingDate: '2026-01-01',
      expiryDate: '2028-01-01',
      notes: 'صاج طبي معقم مجلفن 1.2 مم',
    });
    expect(batch.batchNumber).toBe('LOT-2026-MED-01');

    // Receive 50 Sheets @ 100 EGP = 5,000 EGP
    const receiptMovement = await inventoryService.createMovement({
      itemId: rawItemId,
      warehouseId: rawWarehouseId,
      movementType: 'receipt',
      quantity: '50',
      unitCost: '100.000000',
      note: 'استلام صاج مجلفن من المورد',
    });
    expect(receiptMovement.totalValue).toBe('5000.0000');

    // Verify GL Posting: [Dr Raw Inventory (5,000) / Cr GRNI (5,000)]
    const je1 = journals[0];
    expect(je1.status).toBe('posted');
    expect(je1.lines.find((l: any) => l.accountId === rawInvAccount)?.debitAmount).toBe('5000.0000');
    expect(je1.lines.find((l: any) => l.accountId === grniAccount)?.creditAmount).toBe('5000.0000');

    // ==========================================
    // STEP 2: Record Supplier Purchase Invoice & Clear GRNI
    // ==========================================
    const pinv = await financeService.createPurchaseInvoice({
      orgNodeId,
      supplierId,
      invoiceNumber: 'SUP-INV-STEEL-99',
      invoiceDate: '2026-09-01',
      dueDate: '2026-10-01',
      lines: [{ itemId: rawItemId, quantity: '50', unitCost: '100.000000', taxRate: '14.00' }],
    });
    const postedPinv = await financeService.postPurchaseInvoice(pinv.id);
    expect(postedPinv.status).toBe('posted');

    // Verify GL Posting: [Dr GRNI (5,000) + Dr Input Tax (700) / Cr AP (5,700)]
    const je2 = journals[1];
    expect(je2.lines.find((l: any) => l.accountId === grniAccount)?.debitAmount).toBe('5000.0000');
    expect(je2.lines.find((l: any) => l.accountId === inputVatAccount)?.debitAmount).toBe('700.0000');
    expect(je2.lines.find((l: any) => l.accountId === apAccount)?.creditAmount).toBe('5700.0000');

    // ==========================================
    // STEP 3: Pay Supplier from CIB Bank Account
    // ==========================================
    const payment = await financeService.createPayment({
      orgNodeId,
      supplierId,
      amount: '5700.0000',
      paymentMethod: 'bank_transfer',
      paidFromAccountId: bankAccount,
      referenceNumber: 'TRX-BANK-001',
    });
    await financeService.postPayment(payment.id);

    // Verify GL Posting: [Dr AP (5,700) / Cr Bank (5,700)]
    const je3 = journals[2];
    expect(je3.lines.find((l: any) => l.accountId === apAccount)?.debitAmount).toBe('5700.0000');
    expect(je3.lines.find((l: any) => l.accountId === bankAccount)?.creditAmount).toBe('5700.0000');

    // ==========================================
    // STEP 4: Issue Raw Material to Production (Work Order JO-2026-MED-001)
    // ==========================================
    await inventoryService.createMovement({
      itemId: rawItemId,
      warehouseId: rawWarehouseId,
      movementType: 'issue',
      quantity: '10',
      sourceModule: 'production',
      sourceId: 'wo-100',
      note: 'صرف صاج لتصنيع وحدة درج وضلفة 60',
    });

    // Verify GL Posting: [Dr WIP (1,000) / Cr Raw Inventory (1,000)]
    const je4 = journals[3];
    expect(je4.lines.find((l: any) => l.accountId === wipAccount)?.debitAmount).toBe('1000.0000');
    expect(je4.lines.find((l: any) => l.accountId === rawInvAccount)?.creditAmount).toBe('1000.0000');

    // ==========================================
    // STEP 5: Quality Inspection on Finished Goods
    // ==========================================
    const inspection = await qualityService.createQualityInspection({
      orgNodeId,
      itemId: fgItemId,
      referenceType: 'production_step',
      referenceId: 'step-assembly-1',
      parameters: [{ parameterName: 'سماكة الدهان والأبعاد الطبية', targetValue: 'مطابق 100%' }],
    });
    const evaluatedInsp = await qualityService.evaluateInspection(inspection.id, 'Eng. Quality Inspector', 'مطابق للمواصفات', [
      { parameterId: 'param-1', actualValue: 'مطابق 100%', status: 'pass' },
    ]);
    expect(evaluatedInsp.status).toBe('passed');

    // ==========================================
    // STEP 6: Finished Goods Receipt (Transfer from WIP to FG Inventory)
    // ==========================================
    await inventoryService.createMovement({
      itemId: fgItemId,
      warehouseId: fgWarehouseId,
      movementType: 'receipt',
      quantity: '1',
      unitCost: '3500.000000',
      sourceModule: 'production',
      note: 'استلام وحدة درج وضلفة 60 تامة الصنع',
    });

    // Verify GL Posting: [Dr FG Inventory (3,500) / Cr WIP (3,500)]
    const je5 = journals[4];
    expect(je5.lines.find((l: any) => l.accountId === fgInvAccount)?.debitAmount).toBe('3500.0000');
    expect(je5.lines.find((l: any) => l.accountId === wipAccount)?.creditAmount).toBe('3500.0000');

    // ==========================================
    // STEP 7: Deliver Finished Goods to Cairo Hospital (COGS Trigger)
    // ==========================================
    await inventoryService.createMovement({
      itemId: fgItemId,
      warehouseId: fgWarehouseId,
      movementType: 'issue',
      quantity: '1',
      sourceModule: 'delivery',
      note: 'إذن تسليم وحدة أدراج لمستشفى القاهرة',
    });

    // Verify GL Posting: [Dr COGS (3,500) / Cr FG Inventory (3,500)]
    const je6 = journals[5];
    expect(je6.lines.find((l: any) => l.accountId === cogsAccount)?.debitAmount).toBe('3500.0000');
    expect(je6.lines.find((l: any) => l.accountId === fgInvAccount)?.creditAmount).toBe('3500.0000');

    // ==========================================
    // STEP 8: Issue Sales Invoice to Customer (Hospital)
    // ==========================================
    const sinv = await financeService.createSalesInvoice({
      orgNodeId,
      customerId,
      jobOrderReference: 'JO-2026-MED-001',
      invoiceDate: '2026-09-15',
      dueDate: '2026-10-15',
      lines: [{ itemId: fgItemId, quantity: '1', unitPrice: '10000.0000', taxRate: '14.00' }],
    });
    await financeService.postSalesInvoice(sinv.id);

    // Verify GL Posting: [Dr AR (11,400) / Cr Revenue (10,000) + Cr Output VAT (1,400)]
    const je7 = journals[6];
    expect(je7.lines.find((l: any) => l.accountId === arAccount)?.debitAmount).toBe('11400.0000');
    expect(je7.lines.find((l: any) => l.accountId === revenueAccount)?.creditAmount).toBe('10000.0000');
    expect(je7.lines.find((l: any) => l.accountId === outputVatAccount)?.creditAmount).toBe('1400.0000');

    // ==========================================
    // STEP 9: Collect Customer Payment into CIB Bank Account
    // ==========================================
    await financeService.recordCollection({
      jobOrderReference: 'JO-2026-MED-001',
      amount: '11400.0000',
      paymentMethod: 'bank_transfer',
      receivedInAccountId: bankAccount,
      referenceNumber: 'CUST-DEP-9988',
    });

    // Verify GL Posting: [Dr Bank (11,400) / Cr AR (11,400)]
    const je8 = journals[7];
    expect(je8.lines.find((l: any) => l.accountId === bankAccount)?.debitAmount).toBe('11400.0000');
    expect(je8.lines.find((l: any) => l.accountId === arAccount)?.creditAmount).toBe('11400.0000');

    // ==========================================
    // STEP 10: Settle Monthly VAT Return
    // ==========================================
    const vatSettlement = await accountingService.postVatSettlement(
      orgNodeId,
      '2026-09-30',
      taxAuthorityAccount,
    );
    expect(vatSettlement.vatSummary.netTaxPayable).toBe('700.0000');
    expect(vatSettlement.vatSummary.status).toBe('payable');

    // ==========================================
    // STEP 11: Final Reporting Verification
    // ==========================================
    // 1. Trial Balance must be 100% balanced
    const tb = await accountingService.getTrialBalance(orgNodeId);
    expect(tb.isBalanced).toBe(true);

    // 2. Profit & Loss Verification:
    const pnl = await accountingService.getProfitAndLoss(orgNodeId);
    expect(pnl.totalRevenue).toBe('10000.0000');
    expect(pnl.totalCogs).toBe('3500.0000');
    expect(pnl.grossProfit).toBe('6500.0000');
    expect(pnl.netProfit).toBe('6500.0000');

    // 3. Balance Sheet Verification:
    const bs = await accountingService.getBalanceSheet(orgNodeId, '2026-09-30');
    expect(bs.isBalanced).toBe(true);
  });
});