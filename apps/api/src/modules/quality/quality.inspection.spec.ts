import { QualityService } from './quality.service';
import { QualityRepository } from './quality.repository';
import { QualityValidationError } from './quality.errors';
import type {
  QualityInspectionRecord,
  CreateQualityInspectionInput,
  QualityCheckPointRecord,
  QualityWorkflowRecord,
} from './quality.types';

describe('QualityService — Medical Grade Quality Inspection & SLA Workflows', () => {
  let qualityService: QualityService;
  let qualityRepo: QualityRepository;

  // Mock In-Memory State
  const mockInspections: Map<string, QualityInspectionRecord> = new Map();
  const mockCheckPoints: Map<string, QualityCheckPointRecord> = new Map();
  const mockWorkflows: Map<string, QualityWorkflowRecord> = new Map();

  const mockOrgNodeId = 'org-medical-factory-1';
  const mockItemId = 'item-medical-cabinet-60';

  beforeEach(() => {
    mockInspections.clear();
    mockCheckPoints.clear();
    mockWorkflows.clear();

    qualityRepo = {
      countInspections: jest.fn().mockImplementation(async () => mockInspections.size),
      insertInspection: jest.fn().mockImplementation(async (input) => {
        const record: QualityInspectionRecord = {
          id: input.id,
          inspectionNumber: input.inspectionNumber,
          orgNodeId: input.orgNodeId,
          itemId: input.itemId,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          status: 'pending',
          inspectedBy: null,
          inspectedAt: null,
          notes: input.notes ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          parameters: input.parameters.map((p: any, idx: number) => ({
            id: `param-${idx + 1}`,
            inspectionId: input.id,
            parameterName: p.parameterName,
            targetValue: p.targetValue,
            actualValue: null,
            status: 'pending',
            createdAt: new Date().toISOString(),
          })),
        };
        mockInspections.set(input.id, record);
        return record;
      }),
      findInspectionById: jest.fn().mockImplementation(async (id: string) => {
        return mockInspections.get(id) ?? null;
      }),
      updateInspectionStatus: jest
        .fn()
        .mockImplementation(
          async (
            id: string,
            status: any,
            inspectedBy: string,
            notes?: string,
            paramResults?: any[],
          ) => {
            const insp = mockInspections.get(id);
            if (insp) {
              insp.status = status;
              insp.inspectedBy = inspectedBy;
              insp.inspectedAt = new Date().toISOString();
              if (notes) insp.notes = notes;
              if (paramResults) {
                for (const pr of paramResults) {
                  const param = insp.parameters.find((p) => p.id === pr.parameterId);
                  if (param) {
                    param.actualValue = pr.actualValue;
                    param.status = pr.status;
                  }
                }
              }
            }
            return insp;
          },
        ),

      findCheckPointById: jest
        .fn()
        .mockImplementation(async (id: string) => mockCheckPoints.get(id) ?? null),
      findWorkflowByCheckPoint: jest.fn().mockImplementation(async (cpId: string) => {
        return (
          Array.from(mockWorkflows.values()).find(
            (w) => w.checkPointId === cpId && w.status === 'pending',
          ) ?? null
        );
      }),
      insertWorkflow: jest.fn().mockImplementation(async (input) => {
        const wf: QualityWorkflowRecord = {
          id: input.id,
          checkPointId: input.checkPointId,
          enteredAt: input.enteredAt,
          targetAt: input.targetAt,
          graceUntil: input.graceUntil,
          currentAssigneeId: input.currentAssigneeId ?? null,
          status: input.status ?? 'pending',
          actionTakenAt: null,
          actionTakenById: null,
          resultNote: null,
          escalationLevel: input.escalationLevel ?? 0,
        };
        mockWorkflows.set(input.id, wf);
        return wf;
      }),
      updateWorkflowStatus: jest
        .fn()
        .mockImplementation(async (id: string, status: any, userId: string, note?: string) => {
          const wf = mockWorkflows.get(id);
          if (wf) {
            wf.status = status;
            wf.actionTakenAt = new Date();
            wf.actionTakenById = userId;
            wf.resultNote = note ?? null;
          }
          return wf;
        }),
    } as unknown as QualityRepository;

    qualityService = new QualityService(qualityRepo);
  });

  it('1. Create Inspection: should create quality inspection document with technical parameters', async () => {
    const input: CreateQualityInspectionInput = {
      orgNodeId: mockOrgNodeId,
      itemId: mockItemId,
      referenceType: 'production_step',
      referenceId: 'step-assembly-001',
      notes: 'فحص جودة نهائي لوحدة درج وضلفة 60',
      parameters: [
        { parameterName: 'سماكة الصاج المجلفن', targetValue: '1.2 mm' },
        { parameterName: 'أبعاد الهيكل الخارجي', targetValue: '60 cm x 50 cm' },
        { parameterName: 'درجة نقاء وتغطية الدهان الإلكتروستاتيك', targetValue: '85%' },
      ],
    };

    const inspection = await qualityService.createQualityInspection(input);

    expect(inspection.inspectionNumber).toBe('QINSP-2026-000001');
    expect(inspection.status).toBe('pending');
    expect(inspection.parameters.length).toBe(3);
    expect(inspection.parameters[0]?.parameterName).toBe('سماكة الصاج المجلفن');
    expect(inspection.notes).toBe('فحص جودة نهائي لوحدة درج وضلفة 60');
  });

  it('2. Evaluation - All Pass: should mark inspection as "passed" when all parameters meet standard', async () => {
    const inspection = await qualityService.createQualityInspection({
      orgNodeId: mockOrgNodeId,
      itemId: mockItemId,
      referenceType: 'purchase_receipt',
      referenceId: 'rec-sheet-1',
      parameters: [
        { parameterName: 'سماكة الصاج', targetValue: '1.2 mm' },
        { parameterName: 'خلو السطح من الخدوش', targetValue: '100% سليم' },
      ],
    });

    const evaluated = await qualityService.evaluateInspection(
      inspection.id,
      'inspector-eng-ahmed',
      'تم الفحص والمطابقة للمواصفات الفنية الطبية',
      [
        { parameterId: 'param-1', actualValue: '1.22 mm', status: 'pass' },
        { parameterId: 'param-2', actualValue: 'سليم تماماً', status: 'pass' },
      ],
    );

    expect(evaluated.status).toBe('passed');
    expect(evaluated.inspectedBy).toBe('inspector-eng-ahmed');
    expect(evaluated.parameters[0]?.status).toBe('pass');
    expect(evaluated.parameters[1]?.status).toBe('pass');
  });

  it('3. Medical Safety - Any Fail: should strictly mark inspection as "failed" if even one parameter fails', async () => {
    const inspection = await qualityService.createQualityInspection({
      orgNodeId: mockOrgNodeId,
      itemId: mockItemId,
      referenceType: 'delivery_order',
      referenceId: 'dn-001',
      parameters: [
        { parameterName: 'اختبار الحمل والاتزان', targetValue: '150 kg' },
        { parameterName: 'سلاسة حركة مجاري الأدراج', targetValue: 'سلسة 100%' },
      ],
    });

    const evaluated = await qualityService.evaluateInspection(
      inspection.id,
      'inspector-eng-ahmed',
      'تم رفض الشحنة لوجود عيب في مجرى الدرج السفلي',
      [
        { parameterId: 'param-1', actualValue: '150 kg يتحمل بنجاح', status: 'pass' },
        { parameterId: 'param-2', actualValue: 'يوجد احتكاك وثقل بالحركة', status: 'fail' }, // FAILED!
      ],
    );

    // Strict Medical Standard: 1 Failure = Total Rejection
    expect(evaluated.status).toBe('failed');
    expect(evaluated.parameters[1]?.status).toBe('fail');
  });

  it('4. SLA Workflows: should calculate target duration and grace period correctly', async () => {
    mockCheckPoints.set('cp-1', {
      id: 'cp-1',
      relatedEntityType: 'production_step',
      relatedEntityId: 'step-1',
      orgNodeId: mockOrgNodeId,
      name: 'نقطة فحص مرحلة الليزر',
      targetDurationMinutes: 60, // 1 hour
      gracePeriodMinutes: 15, // 15 mins grace
      assignedRoleId: 'role-qc-lead',
    });

    const wf = await qualityService.initializeWorkflow('cp-1');

    expect(wf.status).toBe('pending');
    expect(wf.targetAt.getTime()).toBeGreaterThan(wf.enteredAt.getTime());
    expect(wf.graceUntil.getTime()).toBeGreaterThan(wf.targetAt.getTime());

    // Approve Checkpoint
    const approvedWf = await qualityService.approveCheckPoint(
      wf.id,
      'qc-lead-user',
      'تم اعتماد خطوة الليزر',
    );
    expect(approvedWf.status).toBe('approved');
    expect(approvedWf.resultNote).toBe('تم اعتماد خطوة الليزر');
  });

  it('5. Validation: should reject inspection with empty parameters', async () => {
    await expect(
      qualityService.createQualityInspection({
        orgNodeId: mockOrgNodeId,
        itemId: mockItemId,
        referenceType: 'production_step',
        referenceId: 'step-1',
        parameters: [],
      }),
    ).rejects.toThrow(QualityValidationError);
  });
});
