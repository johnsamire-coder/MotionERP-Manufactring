import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { PlanningRepository } from './planning.repository';
import { PlanningService } from './planning.service';

@Module({
  controllers: [PlanningController],
  providers: [PlanningService, PlanningRepository],
  exports: [PlanningService],
})
export class PlanningModule {}
