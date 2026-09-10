import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { PlanningController } from './planning.controller';
import { PlanningRepository } from './planning.repository';
import { PlanningService } from './planning.service';

@Module({
  imports: [SalesModule],
  controllers: [PlanningController],
  providers: [PlanningService, PlanningRepository],
})
export class PlanningModule {}
