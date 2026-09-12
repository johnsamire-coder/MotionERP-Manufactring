import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SalesService } from '../sales/sales.service';
import { CostNotFoundError, CostValidationError } from './cost.errors';
import { CostRepository } from './cost.repository';
import type { CreateCostComponentTypeInput, CreateCostEntryInput, CreateJobCostSheetInput, CostComponentTypeRecord, CostEntryRecord, CostSummary, JobCostSheetRecord } from './cost.types';

@Injectable()
export class CostService {
  constructor(
    private readonly repository: CostRepository,
    private readonly salesService: SalesService,
  ) {}

  private async tryGetOrgNodeId(jobOrderReference: string): Promise<string | null> {
    const jobOrders = await this.salesService.getJobOrders();
    return jobOrders.find((jo) => jo.jobOrderNumber === jobOrderReference)?.orgNodeId ?? null;
  }

  async createComponentType(input: CreateCostComponentTypeInput): Promise<CostComponentTypeRecord> {
    const code = input.code.trim().toLowerCase();
    const name = input.name.trim();

    if (!code || !/^[a-z_][a-z0-9_]*$/.test(code)) {
      throw new CostValidationError('Invalid component type code format');
    }
    if (!name) throw new CostValidationError('Name is required');

    const existing = await this.repository.findComponentTypeByCode(code);
    if (existing) throw new CostValidationError(`Component type with code "${code}" already exists`);

    return this.repository.insertComponentType({
      id: randomUUID(), code, name, description: input.description
    });
  }

  async getOrCreateCostSheet(jobOrderReference: string, currencyCode?: string): Promise<JobCostSheetRecord> {
    let sheet = await this.repository.findCostSheetByJobOrder(jobOrderReference);
    if (!sheet) {
      const orgNodeId = await this.tryGetOrgNodeId(jobOrderReference);
      sheet = await this.repository.insertCostSheet({
        id: randomUUID(), jobOrderReference, currencyCode, orgNodeId
      });
    }
    return sheet;
  }

  async addCostEntry(input: CreateCostEntryInput): Promise<CostEntryRecord> {
    const componentType = await this.repository.findComponentTypeById(input.componentTypeId);
    if (!componentType) throw new CostNotFoundError(`Component type ${input.componentTypeId} not found`);

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new CostValidationError('Amount must be positive');
    }

    return this.repository.insertCostEntry({
      id: randomUUID(), ...input
    });
  }

  async getCostSummary(jobOrderReference: string): Promise<CostSummary> {
    const sheet = await this.getOrCreateCostSheet(jobOrderReference);
    const entries = await this.repository.getCostSummary(sheet.id);

    let estimatedTotal = 0;
    let actualTotal = 0;

    const detailedEntries = entries.map(entry => {
      const estimated = Number(entry.estimated);
      const actual = Number(entry.actual);
      const variance = actual - estimated;

      estimatedTotal += estimated;
      actualTotal += actual;

      return {
        componentType: entry.componentType,
        estimated: estimated.toFixed(4),
        actual: actual.toFixed(4),
        variance: variance.toFixed(4)
      };
    });

    const variance = actualTotal - estimatedTotal;
    const margin = estimatedTotal > 0 ? ((estimatedTotal - actualTotal) / estimatedTotal * 100).toFixed(2) : '0.00';

    return {
      jobOrderReference,
      currencyCode: sheet.currencyCode,
      estimatedTotal: estimatedTotal.toFixed(4),
      actualTotal: actualTotal.toFixed(4),
      variance: variance.toFixed(4),
      margin,
      entries: detailedEntries
    };
  }

  async addMaterialCost(jobOrderReference: string, amount: string, description?: string, sourceReference?: string): Promise<CostEntryRecord> {
    const materialType = await this.repository.findComponentTypeByCode('material');
    if (!materialType) throw new CostNotFoundError('Material component type not found');

    const sheet = await this.getOrCreateCostSheet(jobOrderReference);

    return this.addCostEntry({
      costSheetId: sheet.id,
      componentTypeId: materialType.id,
      entryType: 'actual',
      amount,
      currencyCode: sheet.currencyCode,
      description,
      sourceReference
    });
  }

  async addLaborCost(jobOrderReference: string, amount: string, description?: string, sourceReference?: string): Promise<CostEntryRecord> {
    const laborType = await this.repository.findComponentTypeByCode('labor');
    if (!laborType) throw new CostNotFoundError('Labor component type not found');

    const sheet = await this.getOrCreateCostSheet(jobOrderReference);

    return this.addCostEntry({
      costSheetId: sheet.id,
      componentTypeId: laborType.id,
      entryType: 'actual',
      amount,
      currencyCode: sheet.currencyCode,
      description,
      sourceReference
    });
  }
}
