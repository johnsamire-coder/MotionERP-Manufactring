import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { CrmModule } from '../crm/crm.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SettingsModule } from '../settings/settings.module';
import { AccountingModule } from '../accounting/accounting.module';
import { FinanceController } from './finance.controller';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';
import { AccountingRepository } from '../accounting/accounting.repository';

@Module({
  imports: [SalesModule, AccountingModule, CrmModule, InventoryModule, SettingsModule],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceRepository, AccountingRepository],
  exports: [FinanceService],
})
export class FinanceModule {}