import { PurchaseBatchLinkController } from './purchase-batch-link.controller';
import { PurchaseBatchLinkService } from './purchase-batch-link.service';
import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { OrganizationModule } from '../organization/organization.module';
import { SalesModule } from '../sales/sales.module';
import { SettingsModule } from '../settings/settings.module';
import { InventoryAccessService } from './inventory-access.service';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AccountingModule, CatalogModule, AuthModule, OrganizationModule, SalesModule, SettingsModule],
  controllers: [PurchaseBatchLinkController, InventoryController],
  providers: [PurchaseBatchLinkService, InventoryService, InventoryRepository, InventoryAccessService],
  exports: [InventoryService],
})
export class InventoryModule {}