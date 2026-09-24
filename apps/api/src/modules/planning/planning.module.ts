import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionOpsModule } from '../production_ops/production_ops.module';
import { PlanningController } from './planning.controller';
import { PlanningRepository } from './planning.repository';
import { PlanningService } from './planning.service';

@Module({
  imports: [ProductionOpsModule, InventoryModule, CrmModule],
  controllers: [PlanningController],
  providers: [PlanningService, PlanningRepository],
  exports: [PlanningService],
})
export class PlanningModule {}
