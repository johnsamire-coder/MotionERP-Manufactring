import { Injectable } from '@nestjs/common';
import { PlanningService } from '../planning/planning.service';
import { ProductionOpsService } from '../production_ops/production_ops.service';
import { TechnicalService } from '../technical/technical.service';
import { ManufacturingToolsValidationError } from './manufacturing_tools.errors';

export interface ReplaceBomResult {
  currentBomId: string;
  newBomId: string;
  workOrdersUpdated: number;
  productionPlanItemsUpdated: number;
}

@Injectable()
export class ManufacturingToolsService {
  constructor(
    private readonly technicalService: TechnicalService,
    private readonly productionOpsService: ProductionOpsService,
    private readonly planningService: PlanningService,
  ) {}

  async replaceBom(currentBomId: string, newBomId: string): Promise<ReplaceBomResult> {
    if (currentBomId === newBomId) {
      throw new ManufacturingToolsValidationError('currentBomId and newBomId must be different');
    }
    const currentBom = await this.technicalService.getBom(currentBomId);
    const newBom = await this.technicalService.getBom(newBomId);
    if (currentBom.productItemId !== newBom.productItemId) {
      throw new ManufacturingToolsValidationError(
        'currentBomId and newBomId must belong to the same product item',
      );
    }
    if (newBom.status !== 'approved') {
      throw new ManufacturingToolsValidationError(
        `newBomId ${newBomId} is "${newBom.status}" and cannot replace another BOM (must be "approved")`,
      );
    }
    const workOrdersUpdated = await this.productionOpsService.replaceBomInWorkOrders(
      currentBomId,
      newBomId,
    );
    const productionPlanItemsUpdated = await this.planningService.replaceBomInProductionPlanItems(
      currentBomId,
      newBomId,
    );
    return { currentBomId, newBomId, workOrdersUpdated, productionPlanItemsUpdated };
  }
}
