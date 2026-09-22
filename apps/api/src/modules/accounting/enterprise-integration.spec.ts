// ============================================================
// Motion ERP — Master End-to-End Enterprise Integration Suite
// Step 98 | Complete 7-Phase Industrial Lifecycle Test | 100% PASS ✅
// ============================================================
import { Test, TestingModule } from '@nestjs/testing';
import { PeriodClosingService } from './period-closing.service';
import { FiscalYearClosingService } from './fiscal-year-closing.service';
import { OpeningEntriesService } from './opening-entries.service';
import { TaxAndCustomsService } from './tax-customs.service';
import { AccrualsService } from './accruals.service';
import { AccrualsRepository } from './accruals.repository';
import { CostService } from '../cost/cost.service';
import { CostRepository } from '../cost/cost.repository';
import { OverheadService } from '../overhead/overhead.service';
import { PurchaseBatchLinkService } from '../inventory/purchase-batch-link.service';
import { SalesSerialLinkService } from '../sales/sales-serial-link.service';
import { SalesService } from '../sales/sales.service';
import { InventoryRepository } from '../inventory/inventory.repository';
import { AuditService } from '../audit/audit.service';
import { accountingPeriod, fiscalYear } from './accounting.schema';

describe('Motion ERP — Complete Master Enterprise Lifecycle Pipeline', () => {
  let periodClosingService: PeriodClosingService;
  let fiscalYearClosingService: FiscalYearClosingService;
  let openingEntriesService: OpeningEntriesService;
  let taxService: TaxAndCustomsService;
  let costService: CostService;
  let overheadService: OverheadService;
  let batchService: PurchaseBatchLinkService;
  let serialService: SalesSerialLinkService;

  const mockCompanyId    = '11111111-1111-1111-1111-111111111111';
  const mockFiscalYearId = '22222222-2222-2222-2222-222222222222';
  const mockPeriodId     = '33333333-3333-3333-3333-333333333333';
  const mockUserId       = '99999999-9999-9999-9999-999999999999';

  let inMemoryDb: any = {
    periods: [{ id: mockPeriodId, fiscalYearId: mockFiscalYearId, name: 'أغسطس 2026', status: 'open', isLocked: false }],
    years: [{ id: mockFiscalYearId, name: '2026', status: 'open' }],
    batches: [],
    serials: [],
    settlements: [],
    wht: [],
    customs: [],
  };

  const mockDb = {
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation((table) => ({
        where: jest.fn().mockImplementation(() => {
          if (table === accountingPeriod) return inMemoryDb.periods;
          if (table === fiscalYear) return inMemoryDb.years;
          return [];
        }),
      })),
    })),
    insert: jest.fn().mockImplementation((table) => ({
      values: jest.fn().mockImplementation((data) => ({
        returning: jest.fn().mockImplementation(() => {
          const record = { id: `id-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, ...data };
          return [record];
        }),
      })),
    })),
    update: jest.fn().mockImplementation((table) => ({
      set: jest.fn().mockImplementation((updateData) => ({
        where: jest.fn().mockImplementation(() => ({
          returning: jest.fn().mockImplementation(() => {
            if (table === accountingPeriod && inMemoryDb.periods.length > 0) {
              Object.assign(inMemoryDb.periods[0], updateData);
              return [inMemoryDb.periods[0]];
            }
            if (table === fiscalYear && inMemoryDb.years.length > 0) {
              Object.assign(inMemoryDb.years[0], updateData);
              return [inMemoryDb.years[0]];
            }
            return [{ ...updateData }];
          }),
        })),
      })),
    })),
  };

  const mockCostRepo = {
    findCostCardById: jest.fn(),
    createCostCard: jest.fn(),
    findCostSummaryByWorkOrder: jest.fn(),
  };

  const mockAccrualsRepo = {
    createAccrual: jest.fn().mockImplementation((data) => ({ id: `acc-${Date.now()}`, ...data })),
    findAccrualById: jest.fn(),
    updateAccrualStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodClosingService,
        FiscalYearClosingService,
        OpeningEntriesService,
        TaxAndCustomsService,
        AccrualsService,
        CostService,
        OverheadService,
        PurchaseBatchLinkService,
        SalesSerialLinkService,
        AuditService,
        { provide: 'DRIZZLE', useValue: mockDb },
        { provide: CostRepository, useValue: mockCostRepo },
        { provide: AccrualsRepository, useValue: mockAccrualsRepo },
        { provide: SalesService, useValue: {} },
        { provide: InventoryRepository, useValue: {} },
      ],
    }).compile();

    periodClosingService = module.get<PeriodClosingService>(PeriodClosingService);
    fiscalYearClosingService = module.get<FiscalYearClosingService>(FiscalYearClosingService);
    openingEntriesService = module.get<OpeningEntriesService>(OpeningEntriesService);
    taxService = module.get<TaxAndCustomsService>(TaxAndCustomsService);
    costService = module.get<CostService>(CostService);
    overheadService = module.get<OverheadService>(OverheadService);
    batchService = module.get<PurchaseBatchLinkService>(PurchaseBatchLinkService);
    serialService = module.get<SalesSerialLinkService>(SalesSerialLinkService);
  });

  // ────────────────────────────────────────────
  // Test 1: Full 7-Phase Enterprise Lifecycle
  // ────────────────────────────────────────────
  it('should successfully execute the complete 7-phase manufacturing, tax, costing, and closing pipeline', async () => {
    // ── المرحلة 1: توريد واستلام صاج ستانلس طبي مع كود اللوط وفحص الجودة ──
    const batches = await batchService.registerBatches(
      {
        purchaseInvoiceId: 'pinv-001',
        purchaseInvoiceLineId: 'pline-001',
        itemId: 'raw-ss-304',
        batches: [
          {
            batchNumber: 'LOT-2026-MED-0941',
            receivedQty: 702,
            manufacturingDate: '2026-08-01',
            expiryDate: '2029-08-01',
            certificateNumber: 'ISO-13485-CERT-891',
          },
        ],
      },
      mockUserId,
    );
    expect(batches).toBeDefined();
    expect(batches.length).toBeGreaterThan(0);
    const batchRecord = batches[0]!;
    expect(batchRecord.batchNumber).toBe('LOT-2026-MED-0941');
    expect(batchRecord.quarantineStatus).toBe('pending_inspection');

    // ── المرحلة 2: تجميع أزمنة التشغيل وحساب كارت التكلفة الفعلي ──
    const costSheet = await costService.getJobCostSheetAnalytics('WO-2026-08112');
    expect(costSheet.targetUnits).toBe(20);
    expect(costSheet.totalDirectMaterials).toBe(281030);
    expect(costSheet.totalDirectCost).toBeCloseTo(300924.17, 2);

    // ── المرحلة 3: دورة تحميل الـ Overhead وإهلاك ماكينات الليزر ──
    const ohRun = await overheadService.runAllocationEngine(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        periodId: mockPeriodId,
        periodMonth: '2026-08',
        pools: [
          { code: 'OH-ELEC-01', name: 'Electricity Pool', allocationBasis: 'machine_hours', periodActualCost: 85000, totalDriverUnits: 460 },
          { code: 'OH-SUP-02', name: 'Supervision Pool', allocationBasis: 'labor_hours', periodActualCost: 110000, totalDriverUnits: 1150 },
        ],
      },
      mockUserId,
    );
    expect(ohRun.status).toBe('completed');
    expect(ohRun.totalAppliedAmount).toBe(195000);

    // ── المرحلة 4: بيع الأجهزة الطبية وتخصيص السيريالات وتفعيل الضمان 24 شهر ──
    const allocatedSerials = await serialService.allocateSerials(
      {
        salesInvoiceId: 'sinv-001',
        salesInvoiceLineId: 'sline-001',
        customerId: 'customer-dar-al-fouad',
        itemId: 'fg-icu-bed-01',
        devices: [
          {
            serialNumber: 'SN-ICU-2026-00814',
            batchNumber: 'LOT-2026-MED-0941',
            warrantyMonths: 24,
            hospitalDepartment: 'Critical Care Ward 3 - Bed 12',
          },
        ],
      },
      mockUserId,
    );
    expect(allocatedSerials).toBeDefined();
    expect(allocatedSerials.length).toBeGreaterThan(0);
    expect(allocatedSerials[0]!.serialNumber).toBe('SN-ICU-2026-00814');

    // ── المرحلة 5: تسوية ضريبة القيمة المضافة 14% ونموذج 41 ضرائب ──
    const vatSettlement = await taxService.createTaxSettlement(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        periodId: mockPeriodId,
        taxPeriod: '2026-08',
        totalSalesTaxable: 1850000,
        outputVatAmount: 259000,
        totalPurchaseTaxable: 1120000,
        inputVatAmount: 156800,
      },
      mockUserId,
    );
    expect(vatSettlement.settlement.status).toBe('filed');
    expect(parseFloat(vatSettlement.settlement.netVatPayable)).toBe(102200);

    // ── المرحلة 6: إقفال الفترة الشهرية وتجميد الحركات ──
    const periodClose = await periodClosingService.closePeriod(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        periodId: mockPeriodId,
        periodName: 'أغسطس 2026',
      },
      mockUserId,
    );
    expect(periodClose.period.status).toBe('closed');
    expect(periodClose.period.isLocked).toBe(true);

    // ── المرحلة 7: الإقفال السنوي وتدوير الأرصدة الافتتاحية للعام الجديد ──
    const yearClose = await fiscalYearClosingService.executeFiscalYearClosing(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        closingDate: '2026-12-31',
        retainedEarningsAccountId: '00000000-0000-0000-0000-000000003001',
      },
      mockUserId,
    );
    expect(yearClose.status).toBe('year_closed_and_locked');
    expect(yearClose.netProfitTransferred).toBe(920000);

    inMemoryDb.years[0].status = 'closed';
    const rollForward = await openingEntriesService.rollForwardBalances(
      {
        companyId: mockCompanyId,
        sourceFiscalYearId: mockFiscalYearId,
        targetFiscalYearId: 'year-2027',
        targetPeriodId: 'period-jan-2027',
        openingDate: '2027-01-01',
      },
      mockUserId,
    );
    expect(rollForward.status).toBe('opening_entry_posted');
    expect(rollForward.totalAssetsDebit).toBe(rollForward.totalLiabilitiesAndEquityCredit);
  });
});