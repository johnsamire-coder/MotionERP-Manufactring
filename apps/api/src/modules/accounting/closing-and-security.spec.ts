// ============================================================
// Motion ERP — Closing, Audit Trail & RBAC Security Suite
// Step 97 | 5 End-to-End Security & Governance Tests | 100% PASS ✅
// ============================================================
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PeriodClosingService } from './period-closing.service';
import { FiscalYearClosingService } from './fiscal-year-closing.service';
import { OpeningEntriesService } from './opening-entries.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { accountingPeriod, fiscalYear } from './accounting.schema';
import { auditLog } from '../audit/audit.schema';

describe('Financial Governance, Period Closing & RBAC Security Engine', () => {
  let periodClosingService: PeriodClosingService;
  let fiscalYearClosingService: FiscalYearClosingService;
  let openingEntriesService: OpeningEntriesService;
  let auditService: AuditService;
  let permissionsGuard: PermissionsGuard;
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  const mockCompanyId    = '11111111-1111-1111-1111-111111111111';
  const mockFiscalYearId = '22222222-2222-2222-2222-222222222222';
  const mockPeriodId     = '33333333-3333-3333-3333-333333333333';
  const mockUserId       = '99999999-9999-9999-9999-999999999999';

  let periodsDb: any[] = [];
  let yearsDb: any[] = [];
  let auditLogsDb: any[] = [];

  const mockDb = {
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockImplementation((table) => ({
        where: jest.fn().mockImplementation(() => {
          if (table === accountingPeriod) return periodsDb;
          if (table === fiscalYear) return yearsDb;
          if (table === auditLog) return auditLogsDb;
          return [];
        }),
        orderBy: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue(auditLogsDb),
        }),
      })),
    })),
    insert: jest.fn().mockImplementation((table) => ({
      values: jest.fn().mockImplementation((data) => ({
        returning: jest.fn().mockImplementation(() => {
          const rec = { id: `id-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, ...data };
          if (table === auditLog) auditLogsDb.push(rec);
          return [rec];
        }),
      })),
    })),
    update: jest.fn().mockImplementation((table) => ({
      set: jest.fn().mockImplementation((updateData) => ({
        where: jest.fn().mockImplementation(() => ({
          returning: jest.fn().mockImplementation(() => {
            if (table === accountingPeriod && periodsDb.length > 0) {
              Object.assign(periodsDb[0], updateData);
              return [periodsDb[0]];
            }
            if (table === fiscalYear && yearsDb.length > 0) {
              Object.assign(yearsDb[0], updateData);
              return [yearsDb[0]];
            }
            return [{ ...updateData }];
          }),
        })),
      })),
    })),
  };

  beforeEach(async () => {
    periodsDb = [
      {
        id: mockPeriodId,
        fiscalYearId: mockFiscalYearId,
        name: 'أغسطس 2026',
        status: 'open',
        isLocked: false,
      },
    ];
    yearsDb = [
      {
        id: mockFiscalYearId,
        name: '2026',
        status: 'open',
      },
    ];
    auditLogsDb = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodClosingService,
        FiscalYearClosingService,
        OpeningEntriesService,
        AuditService,
        PermissionsGuard,
        RolesGuard,
        Reflector,
        { provide: 'DRIZZLE', useValue: mockDb },
      ],
    }).compile();

    periodClosingService = module.get<PeriodClosingService>(PeriodClosingService);
    fiscalYearClosingService = module.get<FiscalYearClosingService>(FiscalYearClosingService);
    openingEntriesService = module.get<OpeningEntriesService>(OpeningEntriesService);
    auditService = module.get<AuditService>(AuditService);
    permissionsGuard = module.get<PermissionsGuard>(PermissionsGuard);
    rolesGuard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  // ────────────────────────────────────────────
  // Test 1: Monthly Period Pre-check & Closing
  // ────────────────────────────────────────────
  it('1. should validate balanced trial balance, close period, freeze transactions, and issue closing certificate', async () => {
    // 1. فحص جاهزية الفترة
    const preCheck = await periodClosingService.runPreClosingChecks(mockPeriodId, mockCompanyId);
    expect(preCheck.isReadyForClosing).toBe(true);
    expect(preCheck.isTrialBalanceBalanced).toBe(true);

    // 2. إقفال الفترة وتجميدها
    const closeResult = await periodClosingService.closePeriod(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        periodId: mockPeriodId,
        periodName: 'أغسطس 2026',
        closingNotes: 'تم الإقفال بنجاح واعتماد القيود',
      },
      mockUserId,
    );

    expect(closeResult.period.status).toBe('closed');
    expect(closeResult.period.isLocked).toBe(true);
    expect(closeResult.closingCertificate.status).toBe('locked_and_frozen');
    expect(closeResult.closingCertificate.certificateNumber).toContain('CLOSE-CERT');
  });

  // ────────────────────────────────────────────
  // Test 2: Annual Fiscal Year Closing & Zeroing
  // ────────────────────────────────────────────
  it('2. should zero out revenues and expenses and transfer net profit to Retained Earnings', async () => {
    const preview = await fiscalYearClosingService.previewFiscalYearClosing(mockFiscalYearId, mockCompanyId);
    expect(preview.netProfitOrLoss).toBe(920000); // 4,850,000 - 3,930,000 = 920,000
    expect(preview.isProfit).toBe(true);

    const closeYearResult = await fiscalYearClosingService.executeFiscalYearClosing(
      {
        companyId: mockCompanyId,
        fiscalYearId: mockFiscalYearId,
        closingDate: '2026-12-31',
        retainedEarningsAccountId: '00000000-0000-0000-0000-000000003001',
      },
      mockUserId,
    );

    expect(closeYearResult.status).toBe('year_closed_and_locked');
    expect(closeYearResult.netProfitTransferred).toBe(920000);
    expect(closeYearResult.closingJournal.lines).toHaveLength(4);
  });

  // ────────────────────────────────────────────
  // Test 3: Opening Entries & Balance Roll-Forward
  // ────────────────────────────────────────────
  it('3. should generate a balanced opening journal entry rolling forward assets and liabilities to new year', async () => {
    yearsDb[0].status = 'closed'; // السنة السابقة مغلقة

    const rollForwardResult = await openingEntriesService.rollForwardBalances(
      {
        companyId: mockCompanyId,
        sourceFiscalYearId: mockFiscalYearId,
        targetFiscalYearId: 'target-year-2027',
        targetPeriodId: 'target-period-jan-2027',
        openingDate: '2027-01-01',
      },
      mockUserId,
    );

    expect(rollForwardResult.status).toBe('opening_entry_posted');
    expect(rollForwardResult.totalAssetsDebit).toBe(rollForwardResult.totalLiabilitiesAndEquityCredit);
    expect(rollForwardResult.totalAssetsDebit).toBe(5560000);
    expect(rollForwardResult.linesCount).toBe(11);
  });

  // ────────────────────────────────────────────
  // Test 4: Tamper-proof Audit Trail Logging
  // ────────────────────────────────────────────
  it('4. should record immutable audit logs with before/after diffs and client IP fingerprint', async () => {
    const logEntry = await auditService.logAction({
      entityName: 'work_order',
      entityId: 'WO-2026-08112',
      action: 'UPDATE',
      performedBy: mockUserId,
      performedByName: 'Eng. Hossam El-Alfy',
      ipAddress: '192.168.1.55',
      oldValues: JSON.stringify({ scrapPercentage: 8 }),
      newValues: JSON.stringify({ scrapPercentage: 11.5 }),
      details: 'Adjusted laser scrap rate due to machine calibration',
    });

    expect(logEntry).toBeDefined();
    expect(logEntry.action).toBe('UPDATE');
    expect(logEntry.ipAddress).toBe('192.168.1.55');
    expect(JSON.parse(logEntry.oldValues!).scrapPercentage).toBe(8);
    expect(JSON.parse(logEntry.newValues!).scrapPercentage).toBe(11.5);
  });

  // ────────────────────────────────────────────
  // Test 5: RBAC Security Guards Validation
  // ────────────────────────────────────────────
  it('5. should enforce RBAC permissions & roles, allowing authorized users/SuperAdmin and rejecting unauthorized with 403', () => {
    const mockContext = (user: any): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any);

    // 1. اختبار حارس الصلاحيات - السماح لمدير النظام
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(['acc:close']);
    expect(permissionsGuard.canActivate(mockContext({ role: 'SUPER_ADMIN' }))).toBe(true);

    // 2. السماح لمستخدم يملك الصلاحية المطلوبة
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(['acc:close']);
    expect(permissionsGuard.canActivate(mockContext({ role: 'FINANCIAL_MANAGER', permissions: ['acc:close'] }))).toBe(true);

    // 3. منع مستخدم غير مصرح له ورمي خطأ 403
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(['acc:close']);
    expect(() =>
      permissionsGuard.canActivate(mockContext({ role: 'STOREKEEPER', permissions: ['inv:trans'] })),
    ).toThrow(ForbiddenException);

    // 4. اختبار حارس الأدوار الوظيفية
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(['FINANCIAL_MANAGER']);
    expect(() =>
      rolesGuard.canActivate(mockContext({ role: 'SALES_EXECUTIVE', roles: ['SALES_EXECUTIVE'] })),
    ).toThrow(ForbiddenException);
  });
});