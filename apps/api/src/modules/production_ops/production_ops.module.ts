import { Module } from '@nestjs/common';
import { ProductionOpsController } from './production_ops.controller';
import { ProductionOpsRepository } from './production_ops.repository';
import { ProductionOpsService } from './production_ops.service';

@Module({
  controllers: [ProductionOpsController],
  providers: [ProductionOpsService, ProductionOpsRepository],
  exports: [ProductionOpsService],
})
export class ProductionOpsModule {}
