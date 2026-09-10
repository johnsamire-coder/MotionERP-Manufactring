import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CrmModule } from './modules/crm/crm.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PlanningModule } from './modules/planning/planning.module';
import { ProductionModule } from './modules/production/production.module';
import { SalesModule } from './modules/sales/sales.module';
import { TechnicalModule } from './modules/technical/technical.module';

@Module({
  imports: [CoreModule, OrganizationModule, CatalogModule, InventoryModule, CrmModule, SalesModule, PlanningModule, TechnicalModule, ProductionModule],
})
export class AppModule {}
