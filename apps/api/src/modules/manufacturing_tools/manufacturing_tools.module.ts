import { Module } from '@nestjs/common';
import { PlanningModule } from '../planning/planning.module';
import { ProductionOpsModule } from '../production_ops/production_ops.module';
import { TechnicalModule } from '../technical/technical.module';
import { ManufacturingToolsController } from './manufacturing_tools.controller';
import { ManufacturingToolsService } from './manufacturing_tools.service';

@Module({
  imports: [TechnicalModule, ProductionOpsModule, PlanningModule],
  controllers: [ManufacturingToolsController],
  providers: [ManufacturingToolsService],
})
export class ManufacturingToolsModule {}
