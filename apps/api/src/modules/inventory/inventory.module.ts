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
import { GrniReportRepository } from './grni-report.repository';
import { GrniReportService } from './grni-report.service';
import { ReorderController } from './reorder.controller';
import { ReorderService } from './reorder.service';
import { PickListController } from './pick-list.controller';
import { PickListService } from './pick-list.service';
import { WarehouseTreeController } from './warehouse-tree.controller';
import { WarehouseTreeService } from './warehouse-tree.service';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AccountingModule, CatalogModule, AuthModule, OrganizationModule, SalesModule, SettingsModule],
  controllers: [PurchaseBatchLinkController, InventoryController, ReorderController, WarehouseTreeController, PickListController],
  providers: [PurchaseBatchLinkService, InventoryService, InventoryRepository, InventoryAccessService, GrniReportService, GrniReportRepository, ReorderService, WarehouseTreeService, PickListService],
  exports: [InventoryService],
})
export class InventoryModule {}