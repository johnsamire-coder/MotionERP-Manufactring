import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CrmModule } from './modules/crm/crm.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrganizationModule } from './modules/organization/organization.module';

@Module({
  imports: [CoreModule, OrganizationModule, CatalogModule, InventoryModule, CrmModule],
})
export class AppModule {}
