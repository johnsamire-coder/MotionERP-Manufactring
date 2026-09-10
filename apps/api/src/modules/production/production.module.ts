import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionController } from './production.controller';
import { ProductionRepository } from './production.repository';
import { ProductionService } from './production.service';

@Module({
  imports: [InventoryModule],
  controllers: [ProductionController],
  providers: [ProductionService, ProductionRepository],
  exports: [ProductionService],
})
export class ProductionModule {}
