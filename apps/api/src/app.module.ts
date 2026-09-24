import { AuditModule } from './modules/audit/audit.module';
import { Module } from '@nestjs/common';
import { AccountingModule } from './modules/accounting/accounting.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CoreModule } from './core/core.module';
import { CostModule } from './modules/cost/cost.module';
import { CrmModule } from './modules/crm/crm.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HrModule } from './modules/hr/hr.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ProductionModule } from './modules/production/production.module';
import { ProductionOpsModule } from './modules/production_ops/production_ops.module';
import { QualityModule } from './modules/quality/quality.module';
import { SalesModule } from './modules/sales/sales.module';
import { PlanningModule } from './modules/planning/planning.module';
import { TechnicalModule } from './modules/technical/technical.module';
import { AssetsModule } from './modules/assets/assets.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SupportModule } from './modules/support/support.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ManufacturingToolsModule } from './modules/manufacturing_tools/manufacturing_tools.module';

@Module({
  imports: [
    AuditModule,
    CoreModule, OrganizationModule, SettingsModule, CatalogModule, InventoryModule, CrmModule,
    SalesModule, PlanningModule, TechnicalModule, ManufacturingToolsModule, ProductionModule, ProductionOpsModule,
    QualityModule, CostModule, DeliveryModule, AccountingModule, FinanceModule, HrModule, AuthModule, WorkflowModule, SupportModule, ProjectsModule, AssetsModule,
  ],
})
export class AppModule {}

