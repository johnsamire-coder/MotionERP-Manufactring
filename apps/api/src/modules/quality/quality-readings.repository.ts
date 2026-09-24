import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import {
  inspectionReading,
  inspectionTemplate,
  inspectionTemplateParameter,
  qualityInspectionParameter,
} from './quality.schema';
import type {
  CreateInspectionTemplateInput,
  InspectionTemplateRecord,
  ParameterCriteria,
  ReadingRecord,
} from './quality-readings.types';

@Injectable()
export class QualityReadingsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findTemplateByCode(code: string): Promise<{ id: string } | null> {
    const rows = await this.database.db
      .select({ id: inspectionTemplate.id })
      .from(inspectionTemplate)
      .where(eq(inspectionTemplate.code, code))
      .limit(1);
    return rows[0] ?? null;
  }

  async insertTemplate(input: CreateInspectionTemplateInput): Promise<InspectionTemplateRecord> {
    const id = randomUUID();
    await this.database.db
      .insert(inspectionTemplate)
      .values({ id, code: input.code, name: input.name, itemId: input.itemId ?? null });
    await this.database.db.insert(inspectionTemplateParameter).values(
      input.parameters.map((p, i) => ({
        templateId: id,
        parameterName: p.parameterName,
        isNumeric: p.isNumeric,
        minValue: p.minValue ?? null,
        maxValue: p.maxValue ?? null,
        acceptedValue: p.acceptedValue ?? null,
        readingsRequired: p.readingsRequired ?? 1,
        position: i + 1,
      })),
    );
    return (await this.findTemplateById(id))!;
  }

  async listTemplates(): Promise<InspectionTemplateRecord[]> {
    const rows = await this.database.db
      .select({ id: inspectionTemplate.id })
      .from(inspectionTemplate)
      .orderBy(asc(inspectionTemplate.code));
    const out: InspectionTemplateRecord[] = [];
    for (const r of rows) out.push((await this.findTemplateById(r.id))!);
    return out;
  }

  async findTemplateById(id: string): Promise<InspectionTemplateRecord | null> {
    const rows = await this.database.db
      .select()
      .from(inspectionTemplate)
      .where(eq(inspectionTemplate.id, id))
      .limit(1);
    const t = rows[0];
    if (!t) return null;
    const params = await this.database.db
      .select()
      .from(inspectionTemplateParameter)
      .where(eq(inspectionTemplateParameter.templateId, id))
      .orderBy(asc(inspectionTemplateParameter.position));
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      itemId: t.itemId,
      createdAt: t.createdAt.toISOString(),
      parameters: params.map((p) => ({
        id: p.id,
        parameterName: p.parameterName,
        isNumeric: p.isNumeric,
        minValue: p.minValue,
        maxValue: p.maxValue,
        acceptedValue: p.acceptedValue,
        readingsRequired: p.readingsRequired,
        position: p.position,
      })),
    };
  }

  async setParameterCriteria(
    inspectionId: string,
    parameterName: string,
    c: ParameterCriteria,
  ): Promise<void> {
    await this.database.db
      .update(qualityInspectionParameter)
      .set(c)
      .where(
        and(
          eq(qualityInspectionParameter.inspectionId, inspectionId),
          eq(qualityInspectionParameter.parameterName, parameterName),
        ),
      );
  }

  async listParameterCriteria(inspectionId: string): Promise<Map<string, ParameterCriteria>> {
    const rows = await this.database.db
      .select({
        id: qualityInspectionParameter.id,
        isNumeric: qualityInspectionParameter.isNumeric,
        minValue: qualityInspectionParameter.minValue,
        maxValue: qualityInspectionParameter.maxValue,
        acceptedValue: qualityInspectionParameter.acceptedValue,
        readingsRequired: qualityInspectionParameter.readingsRequired,
      })
      .from(qualityInspectionParameter)
      .where(eq(qualityInspectionParameter.inspectionId, inspectionId));
    return new Map(rows.map(({ id, ...c }) => [id, c]));
  }

  async insertReadings(parameterId: string, readings: ReadingRecord[]): Promise<void> {
    if (readings.length === 0) return;
    await this.database.db
      .insert(inspectionReading)
      .values(readings.map((r) => ({ parameterId, ...r })));
  }

  async listReadings(parameterIds: string[]): Promise<Map<string, ReadingRecord[]>> {
    const out = new Map<string, ReadingRecord[]>();
    if (parameterIds.length === 0) return out;
    const rows = await this.database.db
      .select()
      .from(inspectionReading)
      .where(inArray(inspectionReading.parameterId, parameterIds))
      .orderBy(asc(inspectionReading.readingNo));
    for (const r of rows) {
      const list = out.get(r.parameterId) ?? [];
      list.push({ readingNo: r.readingNo, value: r.value, withinSpec: r.withinSpec });
      out.set(r.parameterId, list);
    }
    return out;
  }
}
