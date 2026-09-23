import { PurchaseBatchLinkController } from './purchase-batch-link.controller';
import { PurchaseBatchLinkService } from './purchase-batch-link.service';
import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { CatalogModule } from '../catalog/catalog.module';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AccountingModule, CatalogModule],
  controllers: [PurchaseBatchLinkController, InventoryController],
  providers: [PurchaseBatchLinkService, InventoryService, InventoryRepository],
  exports: [InventoryService],
})
export class InventoryModule {}