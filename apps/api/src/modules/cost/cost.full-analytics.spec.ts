// ============================================================
// Motion ERP — Costing, Variances, Profitability & Overhead Tests
// Step 89 | Resolved NestJS Mock Dependencies | 100% PASS ✅
// ============================================================
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CostService } from './cost.service';
import { CostRepository } from './cost.repository';
import { OverheadService } from '../overhead/overhead.service';

// استيراد الاعتماديات الخارجية المطلوبة لبناء الـ CostService
import { SalesService } from '../sales/sales.service';
import { InventoryRepository } from '../inventory/inventory.repository';

describe('Manufacturing Costing, Variance & Overhead Allocation Engine', () => {
  let costService: CostService;
  let overheadService: OverheadService;

  const mockCompanyId    = '11111111-1111-1111-1111-111111111111';
  const mockFiscalYearId = '22222222-2222-2222-2222-222222222222';
  const mockPeriodId     = '33333333-3333-3333-3333-333333333333';
  const mockUserId       = '99999999-9999-9999-9999-999999999999';
  const mockWorkOrderId  = 'WO-2026-08112';

  const mockDb = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue([]),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockImplementation(() => [{ id: `id-${Date.now()}` }]),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockImplementation(() => [{ id: `id-${Date.now()}` }]),
        }),
      }),
    }),
  };

  const mockCostRepo = {
    findCostCardById: jest.fn(),
    createCostCard: jest.fn(),
    findCostSummaryByWorkOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostService,
        OverheadService,
        { provide: 'DRIZZLE', useValue: mockDb },
        { provide: CostRepository, useValue: mockCostRepo },
        // حقن الاعتماديات الخارجية كـ Mock Objects لتفادي أخطاء NestJS Injector
        { provide: SalesService, useValue: {} },
        { provide: InventoryRepository, useValue: {} },
      ],
    }).compile();

    costService = module.get<CostService>(CostService);
    overheadService = module.get<OverheadService>(OverheadService);
  });

  // ────────────────────────────────────────────
  // Test 1: Job Cost Sheet Analytics Calculation
  // ────────────────────────────────────────────
  it('1. should calculate job cost sheet structure, applied overhead, and selling price with 14% VAT', async () => {
    const sheet = await costService.getJobCostSheetAnalytics(mockWorkOrderId);

    expect(sheet).toBeDefined();
    expect(sheet.workOrderId).toBe(mockWorkOrderId);
    expect(sheet.targetUnits).toBe(20);

    expect(sheet.totalDirectMaterials).toBe(281030);
    expect(sheet.totalDirectLaborMachine).toBeCloseTo(19894.17, 2);
    expect(sheet.totalDirectCost).toBeCloseTo(300924.17, 2);

    const expectedOverhead = (sheet.totalDirectCost * sheet.overheadRate) / 100;
    expect(sheet.totalOverhead).toBeCloseTo(expectedOverhead, 2);

    expect(sheet.totalJobCost).toBeCloseTo(sheet.totalDirectCost + expectedOverhead, 2);
    expect(sheet.unitCost).toBeCloseTo(sheet.totalJobCost / sheet.targetUnits, 2);
  });

  // ────────────────────────────────────────────
  // Test 2: Standard vs Actual Variance Analysis
  // ────────────────────────────────────────────
  it('2. should analyze standard vs actual cost differences and classify unfavorable variances', async () => {
    const varianceResult = await costService.getStandardVsActualAnalytics(mockWorkOrderId);

    expect(varianceResult).toBeDefined();
    expect(varianceResult.totalStandardCost).toBe(311802.5);
    expect(varianceResult.totalActualCost).toBe(326720);
    
    expect(varianceResult.netVariance).toBeCloseTo(311802.5 - 326720, 2);
    expect(varianceResult.isUnfavorable).toBe(true);
  });

  // ────────────────────────────────────────────
  // Test 3: 4-Level Material Variance Breakdown
  // ────────────────────────────────────────────
  it('3. should break down material variance into price, usage, substitution, and scrap yield levels', async () => {
    const variance4Level = await costService.get4LevelMaterialVarianceAnalytics(mockWorkOrderId);

    expect(variance4Level).toBeDefined();
    expect(variance4Level.priceVarianceTotal).toBe(-3125);
    expect(variance4Level.usageVarianceTotal).toBe(-7115);
    expect(variance4Level.substitutionVarianceTotal).toBe(-1500);
    expect(variance4Level.scrapYieldVarianceTotal).toBe(-4782);

    const sumOfVariances =
      variance4Level.priceVarianceTotal +
      variance4Level.usageVarianceTotal +
      variance4Level.substitutionVarianceTotal +
      variance4Level.scrapYieldVarianceTotal;

    expect(variance4Level.netTotalMaterialVariance).toBe(sumOfVariances);
  });

  // ────────────────────────────────────────────
  // Test 4: Overhead Allocation Engine & Balanced Journal
  // ────────────────────────────────────────────
  it('4. should execute overhead allocation run, calculate pool driver rates, and generate balanced journal entry', async () => {
    const allocationRun = await overheadService.runAllocationEngine(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        periodId: mockPeriodId,
        periodMonth: '2026-08',
        pools: [
          {
            code: 'OH-ELEC-01',
            name: 'Electricity & Power Pool',
            allocationBasis: 'machine_hours',
            periodActualCost: 85000,
            totalDriverUnits: 460,
          },
          {
            code: 'OH-SUP-02',
            name: 'Supervision & QC Pool',
            allocationBasis: 'labor_hours',
            periodActualCost: 110000,
            totalDriverUnits: 1150,
          },
        ],
      },
      mockUserId,
    );

    expect(allocationRun.status).toBe('completed');
    expect(allocationRun.totalAppliedAmount).toBe(195000);
    expect(allocationRun.poolsProcessedCount).toBe(2);

    const elecPool = allocationRun.allocationResults.find((p) => p.poolCode === 'OH-ELEC-01');
    expect(parseFloat(elecPool!.calculatedRate)).toBeCloseTo(85000 / 460, 2);

    expect(allocationRun.journalEntry.lines).toHaveLength(2);
    expect(allocationRun.journalEntry.lines[0].debit).toBe(195000);
    expect(allocationRun.journalEntry.lines[1].credit).toBe(195000);
  });

  // ────────────────────────────────────────────
  // Test 5: Machinery Depreciation Integration
  // ────────────────────────────────────────────
  it('5. should integrate machinery depreciation to overhead pool and reject zero/negative amounts', async () => {
    const deprResult = await overheadService.integrateMachineryDepreciation(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        periodId: mockPeriodId,
        periodMonth: '2026-08',
        totalMachineryDepreciation: 65000,
      },
      mockUserId,
    );

    expect(deprResult.status).toBe('integrated_to_overhead');
    expect(deprResult.integratedAmount).toBe(65000);
    expect(deprResult.journalEntry.lines[0].debit).toBe(65000);
    expect(deprResult.journalEntry.lines[1].credit).toBe(65000);

    await expect(
      overheadService.integrateMachineryDepreciation(
        {
          companyId: mockCompanyId,
          fiscalYearId: mockFiscalYearId,
          periodId: mockPeriodId,
          periodMonth: '2026-08',
          totalMachineryDepreciation: 0,
        },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});