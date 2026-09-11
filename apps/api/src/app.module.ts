import { Module } from '@nestjs/common';
import { AccountingModule } from './modules/accounting/accounting.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CoreModule } from './core/core.module';
import { CostModule } from './modules/cost/cost.module';
import { CrmModule } from './modules/crm/crm.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FinanceModule } from './modules/finance/finance.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PlanningModule } from './modules/planning/planning.module';
import { ProductionModule } from './modules/production/production.module';
import { ProductionOpsModule } from './modules/production_ops/production_ops.module';
import { QualityModule } from './modules/quality/quality.module';
import { SalesModule } from './modules/sales/sales.module';
import { TechnicalModule } from './modules/technical/technical.module';

@Module({
  imports: [
    CoreModule, OrganizationModule, CatalogModule, InventoryModule, CrmModule,
    SalesModule, PlanningModule, TechnicalModule, ProductionModule, ProductionOpsModule,
    QualityModule, CostModule, DeliveryModule, AccountingModule, FinanceModule,
  ],
})
export class AppModule {}
