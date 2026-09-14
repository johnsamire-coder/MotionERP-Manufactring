import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PlanningNotFoundError, PlanningValidationError } from './planning.errors';
import { PlanningRepository } from './planning.repository';
import type { CreateSalesForecastInput, SalesForecastRecord } from './planning.types';

@Injectable()
export class PlanningService {
  constructor(private readonly repository: PlanningRepository) {}

  async getSalesForecasts(): Promise<SalesForecastRecord[]> { return this.repository.listSalesForecasts(); }

  async getSalesForecast(id: string): Promise<SalesForecastRecord> {
    const found = await this.repository.findSalesForecastById(id);
    if (!found) throw new PlanningNotFoundError(`sales forecast ${id} does not exist`);
    return found;
  }

  async createSalesForecast(input: CreateSalesForecastInput): Promise<SalesForecastRecord> {
    if (!input.lines || input.lines.length === 0) {
      throw new PlanningValidationError('a sales forecast must have at least one line');
    }
    if (new Date(input.toDate) < new Date(input.fromDate)) {
      throw new PlanningValidationError('toDate cannot be before fromDate');
    }
    for (const line of input.lines) {
      const qty = Number(line.forecastQuantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new PlanningValidationError('every forecast line quantity must be positive');
    }
    const sequence = (await this.repository.countSalesForecasts()) + 1;
    const year = new Date().getFullYear();
    const forecastNumber = `SF-${year}-${String(sequence).padStart(6, '0')}`;
    return this.repository.insertSalesForecast({ id: randomUUID(), forecastNumber, ...input });
  }

  async submitSalesForecast(id: string): Promise<SalesForecastRecord> {
    const found = await this.repository.findSalesForecastById(id);
    if (!found) throw new PlanningNotFoundError(`sales forecast ${id} does not exist`);
    if (found.status !== 'draft') throw new PlanningValidationError(`sales forecast ${id} is "${found.status}" and cannot be submitted (must be "draft")`);
    return this.repository.setSalesForecastStatus(id, 'submitted');
  }
}
