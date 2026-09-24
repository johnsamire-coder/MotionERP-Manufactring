import { CostService } from './cost.service';
import { CostRepository } from './cost.repository';
import { SalesService } from '../sales/sales.service';
import { CostValidationError } from './cost.errors';
import type {
  JobCostSheetRecord,
  CostComponentTypeRecord,
  CostEntryRecord,
  CreateCostEntryInput,
} from './cost.types';
import type { JobOrderRecord } from '../sales/sales.types';

describe('CostService — Job Order Costing, Profitability & Variance Engine', () => {
  let costService: CostService;
  let costRepo: CostRepository;
  let salesService: SalesService;

  const mockOrgNodeId = 'org-factory-1';
  const mockJobOrderNumber = 'JO-2026-CABINET-001';

  const mockSheets: Map<string, JobCostSheetRecord> = new Map();
  const mockEntries: CostEntryRecord[] = [];
  const mockComponentTypes: Map<string, CostComponentTypeRecord> = new Map();

  beforeEach(() => {
    mockSheets.clear();
    mockEntries.length = 0;
    mockComponentTypes.clear();

    mockComponentTypes.set('ct-material', {
      id: 'ct-material',
      code: 'material',
      name: 'خامات ومواد مباشرة',
      description: 'صاج ومقابض وإكسسوارات',
    });

    mockComponentTypes.set('ct-labor', {
      id: 'ct-labor',
      code: 'labor',
      name: 'عمالة وتشغيل ماكينات',
      description: 'أجور تشغيل الليزر والثنايات',
    });

    salesService = {
      getJobOrders: jest.fn().mockResolvedValue([
        {
          id: 'jo-1',
          jobOrderNumber: mockJobOrderNumber,
          orgNodeId: mockOrgNodeId,
        } as JobOrderRecord,
      ]),
    } as unknown as SalesService;

    costRepo = {
      findCostSheetByJobOrder: jest.fn().mockImplementation(async (ref: string) => {
        return mockSheets.get(ref) ?? null;
      }),
      insertCostSheet: jest.fn().mockImplementation(async (input) => {
        const sheet: JobCostSheetRecord = {
          id: input.id,
          jobOrderReference: input.jobOrderReference,
          orgNodeId: input.orgNodeId,
          currencyCode: input.currencyCode ?? 'EGP',
          status: 'draft',
        };
        mockSheets.set(input.jobOrderReference, sheet);
        return sheet;
      }),
      findComponentTypeById: jest.fn().mockImplementation(async (id: string) => {
        return mockComponentTypes.get(id) ?? null;
      }),
      findComponentTypeByCode: jest.fn().mockImplementation(async (code: string) => {
        return Array.from(mockComponentTypes.values()).find((ct) => ct.code === code) ?? null;
      }),
      insertCostEntry: jest
        .fn()
        .mockImplementation(async (input: CreateCostEntryInput & { id: string }) => {
          const entry: CostEntryRecord = {
            id: input.id,
            costSheetId: input.costSheetId,
            componentTypeId: input.componentTypeId,
            entryType: input.entryType,
            amount: input.amount,
            currencyCode: input.currencyCode,
            description: input.description ?? null,
            sourceReference: input.sourceReference ?? null,
          };
          mockEntries.push(entry);
          return entry;
        }),
      getCostSummary: jest.fn().mockImplementation(async (costSheetId: string) => {
        const summaryMap = new Map<string, { estimated: number; actual: number }>();

        for (const entry of mockEntries.filter((e) => e.costSheetId === costSheetId)) {
          const ct = mockComponentTypes.get(entry.componentTypeId);
          const typeCode = ct?.code ?? 'other';
          const cur = summaryMap.get(typeCode) ?? { estimated: 0, actual: 0 };
          if (entry.entryType === 'estimated') cur.estimated += Number(entry.amount);
          if (entry.entryType === 'actual') cur.actual += Number(entry.amount);
          summaryMap.set(typeCode, cur);
        }

        return Array.from(summaryMap.entries()).map(([code, vals]) => ({
          componentType: code,
          estimated: vals.estimated.toFixed(4),
          actual: vals.actual.toFixed(4),
        }));
      }),
    } as unknown as CostRepository;

    costService = new CostService(costRepo, salesService);
  });

  it('1. Cost Sheet Initialization: should create job cost sheet linked to job order', async () => {
    const sheet = await costService.getOrCreateCostSheet(mockJobOrderNumber, 'EGP');

    expect(sheet.jobOrderReference).toBe(mockJobOrderNumber);
    expect(sheet.currencyCode).toBe('EGP');
    expect(sheet.orgNodeId).toBe(mockOrgNodeId);
  });

  it('2. Actual Material & Labor Cost Entries: should record actual production costs', async () => {
    const matEntry = await costService.addMaterialCost(
      mockJobOrderNumber,
      '3500.0000',
      'صرف صاج مجلفن 1.2 مم لوحدة أدراج',
      'MOV-ISSUE-001',
    );

    const laborEntry = await costService.addLaborCost(
      mockJobOrderNumber,
      '1200.0000',
      'تشغيل ليزر فايبر وثناية هيدروليكية',
      'JC-001',
    );

    expect(matEntry.amount).toBe('3500.0000');
    expect(matEntry.entryType).toBe('actual');
    expect(laborEntry.amount).toBe('1200.0000');
    expect(laborEntry.entryType).toBe('actual');
  });

  it('3. Variance & Summary Calculation: should compute estimated vs actual cost and variance', async () => {
    const sheet = await costService.getOrCreateCostSheet(mockJobOrderNumber);

    // Add Estimated Cost (BOM Budget): Material = 3,000 | Labor = 1,000 (Total Budget = 4,000 EGP)
    await costService.addCostEntry({
      costSheetId: sheet.id,
      componentTypeId: 'ct-material',
      entryType: 'estimated',
      amount: '3000.0000',
      currencyCode: 'EGP',
    });
    await costService.addCostEntry({
      costSheetId: sheet.id,
      componentTypeId: 'ct-labor',
      entryType: 'estimated',
      amount: '1000.0000',
      currencyCode: 'EGP',
    });

    // Add Actual Spent Cost: Material = 3,500 (Over budget by 500) | Labor = 800 (Under budget by 200)
    await costService.addCostEntry({
      costSheetId: sheet.id,
      componentTypeId: 'ct-material',
      entryType: 'actual',
      amount: '3500.0000',
      currencyCode: 'EGP',
    });
    await costService.addCostEntry({
      costSheetId: sheet.id,
      componentTypeId: 'ct-labor',
      entryType: 'actual',
      amount: '800.0000',
      currencyCode: 'EGP',
    });

    const summary = await costService.getCostSummary(mockJobOrderNumber);

    expect(summary.estimatedTotal).toBe('4000.0000');
    expect(summary.actualTotal).toBe('4300.0000');
    // Variance = Actual (4300) - Estimated (4000) = +300 EGP (Cost overrun)
    expect(summary.variance).toBe('300.0000');

    // Material Variance Check
    const matRow = summary.entries.find((e) => e.componentType === 'material');
    expect(matRow?.estimated).toBe('3000.0000');
    expect(matRow?.actual).toBe('3500.0000');
    expect(matRow?.variance).toBe('500.0000'); // +500

    // Labor Variance Check
    const laborRow = summary.entries.find((e) => e.componentType === 'labor');
    expect(laborRow?.estimated).toBe('1000.0000');
    expect(laborRow?.actual).toBe('800.0000');
    expect(laborRow?.variance).toBe('-200.0000'); // -200 savings!
  });

  it('4. Validation: should reject negative or non-numeric cost entries', async () => {
    const sheet = await costService.getOrCreateCostSheet(mockJobOrderNumber);

    await expect(
      costService.addCostEntry({
        costSheetId: sheet.id,
        componentTypeId: 'ct-material',
        entryType: 'actual',
        amount: '-100',
        currencyCode: 'EGP',
      }),
    ).rejects.toThrow(CostValidationError);
  });
});
