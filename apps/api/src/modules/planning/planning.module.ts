import { Module } from '@nestjs/common';
import { ProductionOpsModule } from '../production_ops/production_ops.module';
import { PlanningController } from './planning.controller';
import { PlanningRepository } from './planning.repository';
import { PlanningService } from './planning.service';

@Module({
  imports: [ProductionOpsModule],
  controllers: [PlanningController],
  providers: [PlanningService, PlanningRepository],
  exports: [PlanningService],
})
export class PlanningModule {}
