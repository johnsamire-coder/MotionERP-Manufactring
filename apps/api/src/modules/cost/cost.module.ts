import { Module } from '@nestjs/common';
import { CostController } from './cost.controller';
import { CostRepository } from './cost.repository';
import { CostService } from './cost.service';

@Module({
  controllers: [CostController],
  providers: [CostService, CostRepository],
  exports: [CostService],
})
export class CostModule {}
