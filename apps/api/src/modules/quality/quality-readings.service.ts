import { Injectable, Optional } from '@nestjs/common';
import { requestContext } from '../../core/request-context/request-context';
import { CatalogNotFoundError } from '../catalog/catalog.errors';
import { CatalogService } from '../catalog/catalog.service';
import { QualityNotFoundError, QualityValidationError } from './quality.errors';
import { QualityRepository } from './quality.repository';
import { QualityService } from './quality.service';
import { QualityReadingsRepository } from './quality-readings.repository';
import type {
  CreateInspectionFromTemplateInput,
  CreateInspectionTemplateInput,
  InspectionTemplateRecord,
  InspectionWithReadings,
  ParameterCriteria,
  ReadingRecord,
  RecordReadingsInput,
  TemplateParameterInput,
} from './quality-readings.types';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

/** Is a single reading within the parameter's acceptance criteria? */
export function readingWithinSpec(c: ParameterCriteria, value: string): boolean {
  if (c.isNumeric) {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (c.minValue !== null && n < Number(c.minValue)) return false;
    if (c.maxValue !== null && n > Number(c.maxValue)) return false;
    return true;
  }
  return value.trim().toLowerCase() === (c.acceptedValue ?? '').trim().toLowerCase();
}

function describeCriteria(p: TemplateParameterInput): string {
  if (!p.isNumeric) return `= ${p.acceptedValue}`;
  const fmt = (v: string): string => String(Number(v)); // 1.150000 → 1.15
  if (p.minValue !== undefined && p.maxValue !== undefined)
    return `${fmt(p.minValue)} – ${fmt(p.maxValue)}`;
  return p.minValue !== undefined ? `≥ ${fmt(p.minValue)}` : `≤ ${fmt(p.maxValue!)}`;
}

/**
 * Quality inspection with real readings (plan item 9): standard criteria in templates, several
 * readings per criterion, and accepted / rejected computed by the system — never typed in.
 */
@Injectable()
export class QualityReadingsService {
  constructor(
    private readonly repository: QualityReadingsRepository,
    private readonly quality: QualityService,
    private readonly qualityRepository: QualityRepository,
    @Optional() private readonly catalog?: CatalogService,
  ) {}

  async createTemplate(input: CreateInspectionTemplateInput): Promise<InspectionTemplateRecord> {
    const code = input.code?.trim();
    if (!code) throw new QualityValidationError('template code is required');
    if (!input.name?.trim()) throw new QualityValidationError('template name is required');
    if (!input.parameters || input.parameters.length === 0)
      throw new QualityValidationError('a template needs at least one parameter');
    if (await this.repository.findTemplateByCode(code))
      throw new QualityValidationError(`template "${code}" already exists`);
    const names = new Set<string>();
    for (const p of input.parameters) {
      const name = p.parameterName?.trim();
      if (!name) throw new QualityValidationError('parameterName is required');
      if (names.has(name)) throw new QualityValidationError(`parameter "${name}" appears twice`);
      names.add(name);
      const readings = p.readingsRequired ?? 1;
      if (!Number.isInteger(readings) || readings < 1 || readings > 10)
        throw new QualityValidationError('readingsRequired must be 1–10');
      if (p.isNumeric) {
        if (p.minValue === undefined && p.maxValue === undefined)
          throw new QualityValidationError(
            `numeric parameter "${name}" needs minValue and/or maxValue`,
          );
        for (const v of [p.minValue, p.maxValue]) {
          if (v !== undefined && !Number.isFinite(Number(v)))
            throw new QualityValidationError(`limits of "${name}" must be numbers`);
        }
        if (
          p.minValue !== undefined &&
          p.maxValue !== undefined &&
          Number(p.minValue) > Number(p.maxValue)
        ) {
          throw new QualityValidationError(`minValue of "${name}" is greater than maxValue`);
        }
      } else if (!p.acceptedValue?.trim()) {
        throw new QualityValidationError(`non-numeric parameter "${name}" needs acceptedValue`);
      }
    }
    if (input.itemId) await this.assertItemExists(input.itemId);
    return this.repository.insertTemplate({
      ...input,
      code,
      name: input.name.trim(),
      parameters: input.parameters.map((p) => ({ ...p, parameterName: p.parameterName.trim() })),
    });
  }

  async listTemplates(): Promise<InspectionTemplateRecord[]> {
    return this.repository.listTemplates();
  }

  async getTemplate(id: string): Promise<InspectionTemplateRecord> {
    const t = await this.repository.findTemplateById(id);
    if (!t) throw new QualityNotFoundError(`inspection template ${id} does not exist`);
    return t;
  }

  /** Creates a pending inspection whose parameters and criteria are copied from the template. */
  async createInspectionFromTemplate(
    input: CreateInspectionFromTemplateInput,
  ): Promise<InspectionWithReadings> {
    const template = await this.getTemplate(input.templateId);
    const itemId = input.itemId ?? template.itemId;
    if (!itemId)
      throw new QualityValidationError('itemId is required (the template is not tied to an item)');
    if (template.itemId && input.itemId && template.itemId !== input.itemId) {
      throw new QualityValidationError('this template belongs to a different item');
    }
    const inspection = await this.quality.createQualityInspection({
      orgNodeId: input.orgNodeId,
      itemId,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      notes: input.notes ?? `قالب ${template.code}`,
      parameters: template.parameters.map((p) => ({
        parameterName: p.parameterName,
        targetValue: describeCriteria({
          parameterName: p.parameterName,
          isNumeric: p.isNumeric,
          minValue: p.minValue ?? undefined,
          maxValue: p.maxValue ?? undefined,
          acceptedValue: p.acceptedValue ?? undefined,
        }),
      })),
    });
    for (const p of template.parameters) {
      await this.repository.setParameterCriteria(inspection.id, p.parameterName, {
        isNumeric: p.isNumeric,
        minValue: p.minValue,
        maxValue: p.maxValue,
        acceptedValue: p.acceptedValue,
        readingsRequired: p.readingsRequired,
      });
    }
    return this.getInspection(inspection.id);
  }

  async getInspection(id: string): Promise<InspectionWithReadings> {
    const inspection = await this.quality.getInspection(id);
    const criteria = await this.repository.listParameterCriteria(id);
    const readings = await this.repository.listReadings(inspection.parameters.map((p) => p.id));
    return {
      ...inspection,
      parameters: inspection.parameters.map((p) => ({
        ...p,
        ...(criteria.get(p.id) ?? {
          isNumeric: false,
          minValue: null,
          maxValue: null,
          acceptedValue: null,
          readingsRequired: 1,
        }),
        readings: readings.get(p.id) ?? [],
      })),
    };
  }

  /**
   * Records the readings of every parameter at once and computes the result: a parameter passes
   * only if ALL its readings are within spec; the inspection passes only if ALL parameters pass.
   */
  async recordReadings(id: string, input: RecordReadingsInput): Promise<InspectionWithReadings> {
    const inspection = await this.getInspection(id);
    if (inspection.status !== 'pending')
      throw new QualityValidationError(
        `inspection ${inspection.inspectionNumber} is already "${inspection.status}"`,
      );
    const byParam = new Map((input.readings ?? []).map((r) => [r.parameterId, r.values ?? []]));
    const unknown = [...byParam.keys()].filter(
      (pid) => !inspection.parameters.some((p) => p.id === pid),
    );
    if (unknown.length > 0)
      throw new QualityValidationError(`unknown parameter(s): ${unknown.join(', ')}`);

    const results: Array<{
      parameterId: string;
      actualValue: string;
      status: 'pass' | 'fail';
      readings: ReadingRecord[];
    }> = [];
    for (const p of inspection.parameters) {
      const values = (byParam.get(p.id) ?? [])
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0);
      if (values.length < p.readingsRequired) {
        throw new QualityValidationError(
          `"${p.parameterName}" needs ${p.readingsRequired} reading(s), got ${values.length}`,
        );
      }
      if (values.length > 10)
        throw new QualityValidationError(`"${p.parameterName}" accepts at most 10 readings`);
      if (p.isNumeric) {
        const bad = values.find((v) => !Number.isFinite(Number(v)));
        if (bad !== undefined)
          throw new QualityValidationError(
            `"${p.parameterName}" is numeric; "${bad}" is not a number`,
          );
      }
      const readings = values.map((value, i) => ({
        readingNo: i + 1,
        value,
        withinSpec: readingWithinSpec(p, value),
      }));
      const actualValue = p.isNumeric
        ? `${values.join(', ')} (متوسط ${(values.reduce((a, v) => a + Number(v), 0) / values.length).toFixed(4)})`
        : values.join(', ');
      results.push({
        parameterId: p.id,
        actualValue,
        status: readings.every((r) => r.withinSpec) ? 'pass' : 'fail',
        readings,
      });
    }

    for (const r of results) await this.repository.insertReadings(r.parameterId, r.readings);
    const status = results.every((r) => r.status === 'pass') ? 'passed' : 'failed';
    await this.qualityRepository.updateInspectionStatus(
      id,
      status,
      requestContext.currentUserId() ?? SYSTEM_USER_ID,
      input.notes,
      results.map(({ parameterId, actualValue, status: s }) => ({
        parameterId,
        actualValue,
        status: s,
      })),
    );
    return this.getInspection(id);
  }

  private async assertItemExists(itemId: string): Promise<void> {
    if (!this.catalog) return;
    try {
      await this.catalog.getItem(itemId);
    } catch (err) {
      if (err instanceof CatalogNotFoundError)
        throw new QualityNotFoundError(`item ${itemId} does not exist`);
      throw err;
    }
  }
}
