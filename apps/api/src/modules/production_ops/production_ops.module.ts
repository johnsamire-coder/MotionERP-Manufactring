import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { ProductionOpsController } from './production_ops.controller';
import { ProductionOpsRepository } from './production_ops.repository';
import { ProductionOpsService } from './production_ops.service';

@Module({
  imports: [SalesModule],
  controllers: [ProductionOpsController],
  providers: [ProductionOpsService, ProductionOpsRepository],
  exports: [ProductionOpsService],
})
export class ProductionOpsModule {}
