import { CatalogService } from './catalog.service';
import { CatalogRepository } from './catalog.repository';
import { CatalogValidationError, CatalogNotFoundError } from './catalog.errors';
import type {
  UomRecord,
  ItemRecord,
  UomConversionRecord,
  CreateUomConversionInput,
} from './catalog.types';

describe('CatalogService — Multi-UOM Conversion Engine', () => {
  let catalogService: CatalogService;
  let catalogRepo: CatalogRepository;

  const mockItemId = 'item-steel-sheet-60';
  const mockUomSheetId = 'uom-sheet-id';
  const mockUomSqmId = 'uom-sqm-id';
  const mockUomKgId = 'uom-kg-id';

  // Mock In-Memory State
  const mockConversions: Map<string, UomConversionRecord> = new Map();
  const mockUoms: Map<string, UomRecord> = new Map();
  const mockItems: Map<string, ItemRecord> = new Map();

  beforeEach(() => {
    mockConversions.clear();
    mockUoms.clear();
    mockItems.clear();

    mockItems.set(mockItemId, {
      id: mockItemId,
      code: 'ITEM-STEEL-60',
      name: 'صاج مجلفن 1.2 مم',
      description: null,
      itemType: 'raw_material',
      categoryId: 'cat-raw-1',
      baseUnitId: mockUomSqmId, // Base Unit is Square Meter (m2)
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    mockUoms.set(mockUomSheetId, {
      id: mockUomSheetId,
      code: 'SHEET',
      name: 'لوح صاج',
      symbol: 'لوح',
      classCode: 'area',
      decimalPrecision: 2,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    mockUoms.set(mockUomSqmId, {
      id: mockUomSqmId,
      code: 'SQM',
      name: 'متر مربع',
      symbol: 'م²',
      classCode: 'area',
      decimalPrecision: 4,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    mockUoms.set(mockUomKgId, {
      id: mockUomKgId,
      code: 'KG',
      name: 'كيلوجرام',
      symbol: 'كجم',
      classCode: 'weight',
      decimalPrecision: 2,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    catalogRepo = {
      findItemById: jest.fn().mockImplementation(async (id: string) => mockItems.get(id) ?? null),
      findUomById: jest.fn().mockImplementation(async (id: string) => mockUoms.get(id) ?? null),
      listUomConversions: jest.fn().mockImplementation(async (itemId?: string) => {
        const list = Array.from(mockConversions.values());
        return itemId ? list.filter((c) => c.itemId === itemId) : list;
      }),
      findUomConversion: jest.fn().mockImplementation(async (itemId: string, fromId: string, toId: string) => {
        const key = `${itemId}-${fromId}-${toId}`;
        return mockConversions.get(key) ?? null;
      }),
      insertUomConversion: jest.fn().mockImplementation(async (input: CreateUomConversionInput & { id: string }) => {
        const record: UomConversionRecord = {
          id: input.id,
          itemId: input.itemId,
          fromUnitId: input.fromUnitId,
          toUnitId: input.toUnitId,
          conversionFactor: input.conversionFactor,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const key = `${input.itemId}-${input.fromUnitId}-${input.toUnitId}`;
        mockConversions.set(key, record);
        return record;
      }),
    } as unknown as CatalogRepository;

    catalogService = new CatalogService(catalogRepo);
  });

  it('1. Create UOM Conversion Rule: should register conversion factor (1 Sheet = 3.125 m2)', async () => {
    const input: CreateUomConversionInput = {
      itemId: mockItemId,
      fromUnitId: mockUomSheetId,
      toUnitId: mockUomSqmId,
      conversionFactor: '3.125000',
    };

    const conv = await catalogService.createUomConversion(input);

    expect(conv.itemId).toBe(mockItemId);
    expect(conv.fromUnitId).toBe(mockUomSheetId);
    expect(conv.toUnitId).toBe(mockUomSqmId);
    expect(conv.conversionFactor).toBe('3.125000');
  });

  it('2. Direct Conversion: should convert 10 Sheets to 31.25 m2 accurately', async () => {
    // 1 Sheet = 3.125 m2
    await catalogService.createUomConversion({
      itemId: mockItemId,
      fromUnitId: mockUomSheetId,
      toUnitId: mockUomSqmId,
      conversionFactor: '3.125000',
    });

    const result = await catalogService.convertQuantity(
      mockItemId,
      mockUomSheetId,
      mockUomSqmId,
      10, // 10 Sheets
    );

    expect(result.sourceQuantity).toBe(10);
    expect(result.convertedQuantity).toBe(31.25);
    expect(result.conversionFactor).toBe(3.125);
  });

  it('3. Inverse Conversion: should calculate inverse conversion (31.25 m2 to 10 Sheets)', async () => {
    // Conversion is defined as 1 Sheet = 3.125 m2
    await catalogService.createUomConversion({
      itemId: mockItemId,
      fromUnitId: mockUomSheetId,
      toUnitId: mockUomSqmId,
      conversionFactor: '3.125000',
    });

    // We query the inverse: from m2 to Sheets
    const result = await catalogService.convertQuantity(
      mockItemId,
      mockUomSqmId,
      mockUomSheetId,
      31.25, // 31.25 m2
    );

    expect(result.sourceQuantity).toBe(31.25);
    expect(result.convertedQuantity).toBeCloseTo(10, 4);
    expect(result.conversionFactor).toBeCloseTo(1 / 3.125, 4);
  });

  it('4. Identity Conversion: should return same quantity with factor 1 for identical UOMs', async () => {
    const result = await catalogService.convertQuantity(
      mockItemId,
      mockUomKgId,
      mockUomKgId,
      50,
    );

    expect(result.sourceQuantity).toBe(50);
    expect(result.convertedQuantity).toBe(50);
    expect(result.conversionFactor).toBe(1);
  });

  it('5. Validation: should reject same unit rule, zero factor, and missing conversion paths', async () => {
    // 1. Same unit rule
    await expect(
      catalogService.createUomConversion({
        itemId: mockItemId,
        fromUnitId: mockUomSheetId,
        toUnitId: mockUomSheetId,
        conversionFactor: '1.0',
      }),
    ).rejects.toThrow(CatalogValidationError);

    // 2. Zero or negative conversion factor
    await expect(
      catalogService.createUomConversion({
        itemId: mockItemId,
        fromUnitId: mockUomSheetId,
        toUnitId: mockUomSqmId,
        conversionFactor: '0',
      }),
    ).rejects.toThrow(CatalogValidationError);

    // 3. Missing conversion path between Sheet and Kg
    await expect(
      catalogService.convertQuantity(mockItemId, mockUomSheetId, mockUomKgId, 10),
    ).rejects.toThrow(CatalogValidationError);
  });
});