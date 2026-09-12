import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { costComponentType, costEntry, jobCostSheet } from './cost.schema';
import type { CreateCostComponentTypeInput, CreateCostEntryInput, CreateJobCostSheetInput, CostComponentTypeRecord, CostEntryRecord, JobCostSheetRecord } from './cost.types';

const ctColumns = {
  id: costComponentType.id, code: costComponentType.code, name: costComponentType.name, description: costComponentType.description
};

const sheetColumns = {
  id: jobCostSheet.id, jobOrderReference: jobCostSheet.jobOrderReference, orgNodeId: jobCostSheet.orgNodeId, currencyCode: jobCostSheet.currencyCode, status: jobCostSheet.status
};

const entryColumns = {
  id: costEntry.id, costSheetId: costEntry.costSheetId, componentTypeId: costEntry.componentTypeId, entryType: costEntry.entryType,
  amount: costEntry.amount, currencyCode: costEntry.currencyCode, description: costEntry.description, sourceReference: costEntry.sourceReference
};

interface CtRow { id: string; code: string; name: string; description: string | null; }
interface SheetRow { id: string; jobOrderReference: string; orgNodeId: string | null; currencyCode: string; status: string; }
interface EntryRow { id: string; costSheetId: string; componentTypeId: string; entryType: string; amount: string; currencyCode: string; description: string | null; sourceReference: string | null; }

function toCtRecord(row: CtRow): CostComponentTypeRecord { return { id: row.id, code: row.code, name: row.name, description: row.description }; }
function toSheetRecord(row: SheetRow): JobCostSheetRecord { return { id: row.id, jobOrderReference: row.jobOrderReference, orgNodeId: row.orgNodeId, currencyCode: row.currencyCode, status: row.status as any }; }
function toEntryRecord(row: EntryRow): CostEntryRecord { return { id: row.id, costSheetId: row.costSheetId, componentTypeId: row.componentTypeId, entryType: row.entryType as any, amount: row.amount, currencyCode: row.currencyCode, description: row.description, sourceReference: row.sourceReference }; }

@Injectable()
export class CostRepository {
  constructor(private readonly database: DatabaseService) {}

  async findComponentTypeById(id: string): Promise<CostComponentTypeRecord | null> {
    const rows = await this.database.db.select(ctColumns).from(costComponentType).where(eq(costComponentType.id, id)).limit(1);
    return rows[0] ? toCtRecord(rows[0]) : null;
  }

  async findComponentTypeByCode(code: string): Promise<CostComponentTypeRecord | null> {
    const rows = await this.database.db.select(ctColumns).from(costComponentType).where(eq(costComponentType.code, code)).limit(1);
    return rows[0] ? toCtRecord(rows[0]) : null;
  }

  async insertComponentType(input: CreateCostComponentTypeInput & { id: string }): Promise<CostComponentTypeRecord> {
    const rows = await this.database.db.insert(costComponentType).values({
      id: input.id, code: input.code, name: input.name, description: input.description
    }).returning(ctColumns);
    return toCtRecord(rows[0]!);
  }

  async findCostSheetByJobOrder(jobOrderReference: string): Promise<JobCostSheetRecord | null> {
    const rows = await this.database.db.select(sheetColumns).from(jobCostSheet).where(eq(jobCostSheet.jobOrderReference, jobOrderReference)).limit(1);
    return rows[0] ? toSheetRecord(rows[0]) : null;
  }

  async insertCostSheet(input: CreateJobCostSheetInput & { id: string; orgNodeId: string | null }): Promise<JobCostSheetRecord> {
    const rows = await this.database.db.insert(jobCostSheet).values({
      id: input.id, jobOrderReference: input.jobOrderReference, orgNodeId: input.orgNodeId, currencyCode: input.currencyCode ?? 'EGP'
    }).returning(sheetColumns);
    return toSheetRecord(rows[0]!);
  }

  async insertCostEntry(input: CreateCostEntryInput & { id: string }): Promise<CostEntryRecord> {
    const rows = await this.database.db.insert(costEntry).values({
      id: input.id, costSheetId: input.costSheetId, componentTypeId: input.componentTypeId, entryType: input.entryType,
      amount: input.amount, currencyCode: input.currencyCode, description: input.description, sourceReference: input.sourceReference
    }).returning(entryColumns);
    return toEntryRecord(rows[0]!);
  }

  async getCostSummary(costSheetId: string): Promise<Array<{ componentTypeId: string; componentType: string; estimated: string; actual: string }>> {
    const result = await this.database.db.execute(sql`
      SELECT
        e.component_type_id,
        ct.code as component_type,
        COALESCE(SUM(CASE WHEN e.entry_type = 'estimated' THEN e.amount ELSE 0 END), 0) as estimated,
        COALESCE(SUM(CASE WHEN e.entry_type = 'actual' THEN e.amount ELSE 0 END), 0) as actual
      FROM cost.entry e
      LEFT JOIN cost.component_type ct ON e.component_type_id = ct.id
      WHERE e.cost_sheet_id = ${costSheetId}
      GROUP BY e.component_type_id, ct.code
      ORDER BY ct.code
    `);

    return (result.rows as any[]).map(row => ({
      componentTypeId: row.component_type_id,
      componentType: row.component_type || '',
      estimated: String(row.estimated),
      actual: String(row.actual)
    }));
  }
}
