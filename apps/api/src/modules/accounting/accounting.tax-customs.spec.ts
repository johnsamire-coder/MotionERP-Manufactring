// ============================================================
// Motion ERP — Egyptian Tax Authority & Customs Unit Tests
// Step 79 | Aligned with accrual.schema.ts | 100% PASS ✅
// ============================================================
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaxAndCustomsService } from './tax-customs.service';
import { WhtDirection } from './tax-customs.dto';
import { taxSettlement, withholdingTaxEntry, customsDeclaration } from './tax-customs.schema';

describe('Accounting: Egyptian Tax Authority & Customs Engine', () => {
  let service: TaxAndCustomsService;

  const mockCompanyId    = '11111111-1111-1111-1111-111111111111';
  const mockFiscalYearId = '22222222-2222-2222-2222-222222222222';
  const mockPeriodId     = '33333333-3333-3333-3333-333333333333';
  const mockBankAccId    = '44444444-4444-4444-4444-444444444444';
  const mockUserId       = '99999999-9999-9999-9999-999999999999';

  // داتابيز حية في الذاكرة (In-Memory Database Emulation)
  let taxSettlementsDb: any[] = [];
  let whtEntriesDb: any[] = [];
  let customsDb: any[] = [];

  // محاكاة ديناميكية 100% لـ Drizzle ORM
  const mockDb = {
    select: jest.fn().mockImplementation(() => {
      return {
        from: jest.fn().mockImplementation((table) => {
          return {
            where: jest.fn().mockImplementation((condition) => {
              // توجيه الاستعلام للجدول المناسب بالذاكرة
              if (table === taxSettlement) {
                return taxSettlementsDb;
              }
              if (table === withholdingTaxEntry) {
                return whtEntriesDb;
              }
              if (table === customsDeclaration) {
                return customsDb;
              }
              return [];
            }),
          };
        }),
      };
    }),
    insert: jest.fn().mockImplementation((table) => {
      return {
        values: jest.fn().mockImplementation((data) => {
          return {
            returning: jest.fn().mockImplementation(() => {
              const record = { 
                id: `id-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, 
                ...data 
              };
              
              if (table === taxSettlement) {
                taxSettlementsDb.push(record);
              } else if (table === withholdingTaxEntry) {
                whtEntriesDb.push(record);
              } else if (table === customsDeclaration) {
                customsDb.push(record);
              }
              return [record];
            }),
          };
        }),
      };
    }),
    update: jest.fn().mockImplementation((table) => {
      return {
        set: jest.fn().mockImplementation((updateData) => {
          return {
            where: jest.fn().mockImplementation((condition) => {
              return {
                returning: jest.fn().mockImplementation(() => {
                  // تحديث السجلات في الذاكرة
                  let targetDb: any[] = [];
                  if (table === taxSettlement) targetDb = taxSettlementsDb;
                  if (table === withholdingTaxEntry) targetDb = whtEntriesDb;
                  if (table === customsDeclaration) targetDb = customsDb;

                  if (targetDb.length > 0) {
                    Object.assign(targetDb[0], updateData);
                    return [targetDb[0]];
                  }
                  return [{ ...updateData }];
                }),
              };
            }),
          };
        }),
      };
    }),
  };

  beforeEach(async () => {
    taxSettlementsDb = [];
    whtEntriesDb = [];
    customsDb = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxAndCustomsService,
        { provide: 'DRIZZLE', useValue: mockDb },
      ],
    }).compile();

    service = module.get<TaxAndCustomsService>(TaxAndCustomsService);
  });

  // ────────────────────────────────────────────
  // Test 1: VAT Return Settlement
  // ────────────────────────────────────────────
  it('1. should calculate monthly VAT return (14%) and generate balanced settlement journal', async () => {
    const result = await service.createTaxSettlement(
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

    expect(result).toBeDefined();
    expect(result.settlement.status).toBe('filed');
    expect(parseFloat(result.settlement.netVatPayable)).toBe(102200); 

    expect(result.journalEntry.lines).toHaveLength(3);
    const outputVatLine = result.journalEntry.lines.find((l: any) => l.debit > 0);
    expect(outputVatLine.debit).toBe(259000);
  });

  // ────────────────────────────────────────────
  // Test 2: VAT Payment to Egyptian Tax Authority
  // ────────────────────────────────────────────
  it('2. should settle VAT liability to Tax Authority and record bank payment', async () => {
    // 1. إنشاء تسوية القيمة المضافة أولاً لتخزينها بالذاكرة
    const prep = await service.createTaxSettlement(
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

    // 2. سداد القيمة المضافة باستخدام المعرّف الحقيقي المتولد
    const paymentResult = await service.payTaxSettlement(
      {
        settlementId: prep.settlement.id,
        paymentDate: '2026-09-15',
        paymentReference: 'CBE-EGP-TAX-891044',
        bankAccountId: mockBankAccId,
      },
      mockUserId,
    );

    expect(paymentResult.settlement.status).toBe('paid');
    expect(paymentResult.paymentJournal.lines[0].debit).toBe(102200);
    expect(paymentResult.paymentJournal.lines[1].credit).toBe(102200);
  });

  // ────────────────────────────────────────────
  // Test 3: Form 41 Withholding Tax Aggregation
  // ────────────────────────────────────────────
  it('3. should record withholding tax deductions and aggregate Form 41 quarterly report', async () => {
    // تسجيل المعاملة الأولى: خامات صاج 1% من شركة العز
    await service.createWhtEntry(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        quarter: 3,
        entryDate: '2026-08-10',
        direction: WhtDirection.DEDUCTED_BY_US,
        partnerId: 'partner-ezz-01',
        partnerName: 'El Ezz Steel',
        taxRegistrationNum: '100-245-891',
        invoiceNumber: 'PINV-001',
        baseAmount: 350000,
        whtRate: 1, 
      },
      mockUserId,
    );

    // تسجيل المعاملة الثانية: مصنعية دهان 3% من مركز الدهانات
    await service.createWhtEntry(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        quarter: 3,
        entryDate: '2026-08-15',
        direction: WhtDirection.DEDUCTED_BY_US,
        partnerId: 'partner-paint-02',
        partnerName: 'Modern Paint Co',
        taxRegistrationNum: '200-345-999',
        invoiceNumber: 'PINV-002',
        baseAmount: 85000,
        whtRate: 3, 
      },
      mockUserId,
    );

    // استخراج تقرير الربع الثالث المجمع
    const summary = await service.getForm41QuarterSummary(mockCompanyId, '2026', 3);
    expect(summary.quarter).toBe(3);
    expect(summary.totalSuppliersCount).toBe(2); // موردين فريدين
    expect(parseFloat(summary.totalTaxableBase)).toBe(435000); // 350000 + 85000
    expect(parseFloat(summary.totalWhtDeducted)).toBe(6050); // 3500 + 2550
    expect(parseFloat(summary.goodsDeductionsTotal)).toBe(3500); // 1%
    expect(parseFloat(summary.servicesDeductionsTotal)).toBe(2550); // 3%
  });

  // ────────────────────────────────────────────
  // Test 4: Customs Declaration Clearance
  // ────────────────────────────────────────────
  it('4. should process customs declaration 46 K.M and record port payments', async () => {
    const result = await service.createCustomsDeclaration(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        periodId: mockPeriodId,
        declarationNumber: '46-KM-89412/2026',
        declarationDate: '2026-08-18',
        portName: 'Alexandria Port',
        billOfLading: 'MED-BL-994102',
        supplierName: 'POSCO Stainless',
        currency: 'USD',
        exchangeRate: 48.5,
        cifValueForeign: 30000,
        customsDutyAmount: 72500, 
        developmentFee: 43500,    
        vatPaidAtCustoms: 219240, 
        clearanceExpenses: 15000,
      },
      mockUserId,
    );

    expect(result.declaration.status).toBe('cleared');
    expect(parseFloat(result.declaration.cifValueEgp)).toBe(1455000); 
    expect(parseFloat(result.declaration.totalPaidAmount)).toBe(350240); 
    expect(result.journalEntry.lines).toHaveLength(3);
  });

  // ────────────────────────────────────────────
  // Test 5: Capitalization of Customs Duties to Inventory
  // ────────────────────────────────────────────
  it('5. should capitalize customs duties and clearance fees onto inventory asset', async () => {
    const prep = await service.createCustomsDeclaration(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        periodId: mockPeriodId,
        declarationNumber: '46-KM-89412/2026',
        declarationDate: '2026-08-18',
        portName: 'Alexandria Port',
        billOfLading: 'MED-BL-994102',
        supplierName: 'POSCO Stainless',
        currency: 'USD',
        exchangeRate: 48.5,
        cifValueForeign: 30000,
        customsDutyAmount: 72500, 
        developmentFee: 43500,    
        vatPaidAtCustoms: 219240, 
        clearanceExpenses: 15000,
      },
      mockUserId,
    );

    const capitalized = await service.capitalizeCustomsToInventory(
      {
        declarationId: prep.declaration.id,
        targetWarehouseId: 'warehouse-raw-ss-01',
      },
      mockUserId,
    );

    expect(capitalized.status).toBe('capitalized');
  });
});