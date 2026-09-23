import type { CatalogService } from '../catalog/catalog.service';
import type { QualityRepository } from './quality.repository';
import type { QualityService } from './quality.service';
import type { QualityInspectionRecord } from './quality.types';
import type { QualityReadingsRepository } from './quality-readings.repository';
import { QualityReadingsService, readingWithinSpec } from './quality-readings.service';
import type { CreateInspectionTemplateInput, InspectionTemplateRecord, ParameterCriteria, ReadingRecord } from './quality-readings.types';

describe('Quality inspection with real readings (plan item 9)', () => {
  const num = (min: string | null, max: string | null, n = 1): ParameterCriteria =>
    ({ isNumeric: true, minValue: min, maxValue: max, acceptedValue: null, readingsRequired: n });

  it('1. readingWithinSpec: numeric range (either bound optional) and text acceptance', () => {
    expect(readingWithinSpec(num('10', '12'), '11.5')).toBe(true);
    expect(readingWithinSpec(num('10', '12'), '12.01')).toBe(false);
    expect(readingWithinSpec(num('10', null), '999')).toBe(true);
    expect(readingWithinSpec(num(null, '5'), '5')).toBe(true);
    expect(readingWithinSpec(num('1', '2'), 'abc')).toBe(false);
    const text: ParameterCriteria = { isNumeric: false, minValue: null, maxValue: null, acceptedValue: 'OK', readingsRequired: 1 };
    expect(readingWithinSpec(text, ' ok ')).toBe(true);
    expect(readingWithinSpec(text, 'scratch')).toBe(false);
  });

  describe('templates and readings', () => {
    let templates: Map<string, InspectionTemplateRecord>;
    let inspection: QualityInspectionRecord;
    let criteria: Map<string, ParameterCriteria>;
    let readings: Map<string, ReadingRecord[]>;
    let service: QualityReadingsService;
    let updated: { status?: string; results?: Array<{ parameterId: string; status: string; actualValue: string }> };

    beforeEach(() => {
      templates = new Map();
      criteria = new Map();
      readings = new Map();
      updated = {};
      const repo = {
        findTemplateByCode: jest.fn().mockImplementation(async (code: string) => [...templates.values()].find((t) => t.code === code) ?? null),
        insertTemplate: jest.fn().mockImplementation(async (i: CreateInspectionTemplateInput) => {
          const t: InspectionTemplateRecord = {
            id: 't-1', code: i.code, name: i.name, itemId: i.itemId ?? null, createdAt: '',
            parameters: i.parameters.map((p, n) => ({
              id: `tp-${n}`, parameterName: p.parameterName, isNumeric: p.isNumeric, minValue: p.minValue ?? null,
              maxValue: p.maxValue ?? null, acceptedValue: p.acceptedValue ?? null, readingsRequired: p.readingsRequired ?? 1, position: n + 1,
            })),
          };
          templates.set(t.id, t);
          return t;
        }),
        findTemplateById: jest.fn().mockImplementation(async (id: string) => templates.get(id) ?? null),
        setParameterCriteria: jest.fn().mockImplementation(async (_i: string, name: string, c: ParameterCriteria) => {
          const p = inspection.parameters.find((x) => x.parameterName === name)!;
          criteria.set(p.id, c);
        }),
        listParameterCriteria: jest.fn().mockImplementation(async () => criteria),
        insertReadings: jest.fn().mockImplementation(async (pid: string, r: ReadingRecord[]) => { readings.set(pid, r); }),
        listReadings: jest.fn().mockImplementation(async () => readings),
      } as unknown as QualityReadingsRepository;
      const quality = {
        createQualityInspection: jest.fn().mockImplementation(async (i) => {
          inspection = {
            id: 'qi-1', inspectionNumber: 'QINSP-1', orgNodeId: i.orgNodeId, itemId: i.itemId, referenceType: i.referenceType,
            referenceId: i.referenceId, status: 'pending', inspectedBy: null, inspectedAt: null, notes: null, createdAt: '', updatedAt: '',
            parameters: i.parameters.map((p: { parameterName: string; targetValue: string }, n: number) => ({
              id: `p-${n}`, inspectionId: 'qi-1', parameterName: p.parameterName, targetValue: p.targetValue, actualValue: null, status: 'pending', createdAt: '',
            })),
          } as QualityInspectionRecord;
          return inspection;
        }),
        getInspection: jest.fn().mockImplementation(async () => inspection),
      } as unknown as QualityService;
      const qualityRepo = {
        updateInspectionStatus: jest.fn().mockImplementation(async (_id: string, status: string, _by: string, _n: string, results) => {
          updated = { status, results };
          inspection.status = status as QualityInspectionRecord['status'];
          for (const r of results) {
            const p = inspection.parameters.find((x) => x.id === r.parameterId)!;
            p.status = r.status;
            p.actualValue = r.actualValue;
          }
          return inspection;
        }),
      } as unknown as QualityRepository;
      const catalog = { getItem: jest.fn().mockResolvedValue({ id: 'item-1' }) } as unknown as CatalogService;
      service = new QualityReadingsService(repo, quality, qualityRepo, catalog);
    });

    const template = (): Promise<InspectionTemplateRecord> => service.createTemplate({
      code: 'STEEL-QC', name: 'فحص الصاج', itemId: 'item-1',
      parameters: [
        { parameterName: 'السُمك (مم)', isNumeric: true, minValue: '1.15', maxValue: '1.25', readingsRequired: 3 },
        { parameterName: 'السطح', isNumeric: false, acceptedValue: 'سليم' },
      ],
    });

    it('2. validates templates', async () => {
      await expect(service.createTemplate({ code: 'X', name: 'x', parameters: [{ parameterName: 'a', isNumeric: true }] }))
        .rejects.toThrow(/needs minValue and\/or maxValue/);
      await expect(service.createTemplate({ code: 'X', name: 'x', parameters: [{ parameterName: 'a', isNumeric: false }] }))
        .rejects.toThrow(/needs acceptedValue/);
      await expect(service.createTemplate({ code: 'X', name: 'x', parameters: [{ parameterName: 'a', isNumeric: true, minValue: '5', maxValue: '1' }] }))
        .rejects.toThrow(/greater than maxValue/);
      await template();
      await expect(template()).rejects.toThrow(/already exists/);
    });

    it('3. an inspection copies the template criteria; all readings in spec → passed (computed, not typed)', async () => {
      const t = await template();
      const qi = await service.createInspectionFromTemplate({ templateId: t.id, orgNodeId: 'o', referenceType: 'purchase_receipt', referenceId: 'r' });
      expect(qi.parameters[0]).toMatchObject({ targetValue: '1.15 – 1.25', readingsRequired: 3, isNumeric: true });
      const done = await service.recordReadings(qi.id, { readings: [
        { parameterId: 'p-0', values: ['1.18', '1.20', '1.22'] },
        { parameterId: 'p-1', values: ['سليم'] },
      ] });
      expect(done.status).toBe('passed');
      expect(done.parameters[0]!.actualValue).toBe('1.18, 1.20, 1.22 (متوسط 1.2000)');
    });

    it('4. one reading out of spec fails its parameter and the whole inspection', async () => {
      const t = await template();
      const qi = await service.createInspectionFromTemplate({ templateId: t.id, orgNodeId: 'o', referenceType: 'purchase_receipt', referenceId: 'r' });
      const done = await service.recordReadings(qi.id, { readings: [
        { parameterId: 'p-0', values: ['1.18', '1.30', '1.22'] },
        { parameterId: 'p-1', values: ['سليم'] },
      ] });
      expect(done.status).toBe('failed');
      expect(updated.results?.map((r) => r.status)).toEqual(['fail', 'pass']);
      expect(readings.get('p-0')?.map((r) => r.withinSpec)).toEqual([true, false, true]);
    });

    it('5. rejects missing readings, non-numbers and re-evaluation', async () => {
      const t = await template();
      const qi = await service.createInspectionFromTemplate({ templateId: t.id, orgNodeId: 'o', referenceType: 'purchase_receipt', referenceId: 'r' });
      await expect(service.recordReadings(qi.id, { readings: [{ parameterId: 'p-0', values: ['1.2'] }, { parameterId: 'p-1', values: ['سليم'] }] }))
        .rejects.toThrow(/needs 3 reading/);
      await expect(service.recordReadings(qi.id, { readings: [{ parameterId: 'p-0', values: ['1.2', 'x', '1.2'] }, { parameterId: 'p-1', values: ['سليم'] }] }))
        .rejects.toThrow(/not a number/);
      await service.recordReadings(qi.id, { readings: [{ parameterId: 'p-0', values: ['1.2', '1.2', '1.2'] }, { parameterId: 'p-1', values: ['سليم'] }] });
      await expect(service.recordReadings(qi.id, { readings: [] })).rejects.toThrow(/already "passed"/);
    });
  });
});
