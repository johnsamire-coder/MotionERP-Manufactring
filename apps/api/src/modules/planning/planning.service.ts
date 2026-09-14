import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PlanningNotFoundError, PlanningValidationError } from './planning.errors';
import { PlanningRepository } from './planning.repository';
import { ProductionOpsService } from '../production_ops/production_ops.service';
import type {
  CreateMaterialRequestInput, CreateProductionPlanInput, CreateSalesForecastInput,
  MaterialRequestRecord, ProductionPlanRecord, SalesForecastRecord,
  CreateItemLeadTimeInput, ItemLeadTimeRecord,
} from './planning.types';

@Injectable()
export class PlanningService {
  constructor(
    private readonly repository: PlanningRepository,
    private readonly productionOpsService: ProductionOpsService,
  ) {}

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

  async getMaterialRequests(): Promise<MaterialRequestRecord[]> { return this.repository.listMaterialRequests(); }

  async getMaterialRequest(id: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findMaterialRequestById(id);
    if (!found) throw new PlanningNotFoundError(`material request ${id} does not exist`);
    return found;
  }

  async createMaterialRequest(input: CreateMaterialRequestInput): Promise<MaterialRequestRecord> {
    if (!input.lines || input.lines.length === 0) {
      throw new PlanningValidationError('a material request must have at least one line');
    }
    for (const line of input.lines) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) throw new PlanningValidationError('every material request line quantity must be positive');
    }
    const sequence = (await this.repository.countMaterialRequests()) + 1;
    const year = new Date().getFullYear();
    const requestNumber = `MR-${year}-${String(sequence).padStart(6, '0')}`;
    return this.repository.insertMaterialRequest({ id: randomUUID(), requestNumber, ...input });
  }

  async submitMaterialRequest(id: string): Promise<MaterialRequestRecord> {
    const found = await this.repository.findMaterialRequestById(id);
    if (!found) throw new PlanningNotFoundError(`material request ${id} does not exist`);
    if (found.status !== 'draft') throw new PlanningValidationError(`material request ${id} is "${found.status}" and cannot be submitted (must be "draft")`);
    return this.repository.setMaterialRequestStatus(id, 'submitted');
  }

  async getProductionPlans(): Promise<ProductionPlanRecord[]> { return this.repository.listProductionPlans(); }

  async getProductionPlan(id: string): Promise<ProductionPlanRecord> {
    const found = await this.repository.findProductionPlanById(id);
    if (!found) throw new PlanningNotFoundError(`production plan ${id} does not exist`);
    return found;
  }

  async createProductionPlan(input: CreateProductionPlanInput): Promise<ProductionPlanRecord> {
    if (!input.items || input.items.length === 0) {
      throw new PlanningValidationError('a production plan must have at least one item');
    }
    if (new Date(input.toDate) < new Date(input.fromDate)) {
      throw new PlanningValidationError('toDate cannot be before fromDate');
    }
    for (const it of input.items) {
      const qty = Number(it.qtyToPlan);
      if (!Number.isFinite(qty) || qty <= 0) throw new PlanningValidationError('every production plan item quantity must be positive');
    }
    const sequence = (await this.repository.countProductionPlans()) + 1;
    const year = new Date().getFullYear();
    const planNumber = `PP-${year}-${String(sequence).padStart(6, '0')}`;
    return this.repository.insertProductionPlan({ id: randomUUID(), planNumber, ...input });
  }

  async submitProductionPlan(id: string): Promise<ProductionPlanRecord> {
    const found = await this.repository.findProductionPlanById(id);
    if (!found) throw new PlanningNotFoundError(`production plan ${id} does not exist`);
    if (found.status !== 'draft') throw new PlanningValidationError(`production plan ${id} is "${found.status}" and cannot be submitted (must be "draft")`);
    return this.repository.setProductionPlanStatus(id, 'submitted');
  }

  async createWorkOrdersFromPlan(id: string): Promise<ProductionPlanRecord> {
    const plan = await this.repository.findProductionPlanById(id);
    if (!plan) throw new PlanningNotFoundError(`production plan ${id} does not exist`);
    if (plan.status !== 'submitted') throw new PlanningValidationError(`production plan ${id} is "${plan.status}" and cannot generate work orders (must be "submitted")`);
    for (const it of plan.items) {
      if (it.workOrderId) continue;
      if (!it.warehouseId) throw new PlanningValidationError(`item ${it.id} has no finished goods warehouse set; cannot create a work order for it`);
      const wo = await this.productionOpsService.createWorkOrder({
        productItemId: it.productItemId, bomId: it.bomId, orgNodeId: plan.orgNodeId,
        qtyToManufacture: it.qtyToPlan, finishedGoodsWarehouseId: it.warehouseId,
      });
      await this.repository.setPpItemWorkOrder(it.id, wo.id);
    }
    const updated = await this.repository.findProductionPlanById(id);
    const allDone = updated!.items.every((it) => it.workOrderId);
    if (allDone) return this.repository.setProductionPlanStatus(id, 'completed');
    return updated!;
  }

  async getItemLeadTimes(): Promise<ItemLeadTimeRecord[]> { return this.repository.listItemLeadTimes(); }

  async getItemLeadTime(id: string): Promise<ItemLeadTimeRecord> {
    const found = await this.repository.findItemLeadTimeById(id);
    if (!found) throw new PlanningNotFoundError(`item lead time ${id} does not exist`);
    return found;
  }

  async createItemLeadTime(input: CreateItemLeadTimeInput): Promise<ItemLeadTimeRecord> {
    const existing = await this.repository.findItemLeadTimeByItemId(input.itemId);
    if (existing) throw new PlanningValidationError(`an item lead time record already exists for item ${input.itemId}`);
    for (const s of input.supplierLeadTimes ?? []) {
      const days = Number(s.leadTimeDays);
      if (!Number.isFinite(days) || days <= 0) throw new PlanningValidationError('every supplier lead time must be a positive number of days');
    }
    return this.repository.insertItemLeadTime({ id: randomUUID(), ...input });
  }
}
