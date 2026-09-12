import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { CostController } from './cost.controller';
import { CostRepository } from './cost.repository';
import { CostService } from './cost.service';

@Module({
  imports: [SalesModule],
  controllers: [CostController],
  providers: [CostService, CostRepository],
  exports: [CostService],
})
export class CostModule {}
