import { Module } from '@nestjs/common';
import { CostModule } from '../cost/cost.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesModule } from '../sales/sales.module';
import { ProductionController } from './production.controller';
import { ProductionRepository } from './production.repository';
import { ProductionService } from './production.service';

@Module({
  imports: [InventoryModule, SalesModule, CostModule],
  controllers: [ProductionController],
  providers: [ProductionService, ProductionRepository],
  exports: [ProductionService],
})
export class ProductionModule {}
