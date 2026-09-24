import { AdvanceController } from './advance.controller';
import { AdvanceService } from './advance.service';
import { LedgerHealthController } from './ledger-health.controller';
import { LedgerHealthService } from './ledger-health.service';
import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { CrmModule } from '../crm/crm.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SettingsModule } from '../settings/settings.module';
import { AccountingModule } from '../accounting/accounting.module';
import { FinanceController } from './finance.controller';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';
import { PurchaseInvoiceHoldService } from './purchase-invoice-hold.service';
import { PurchaseInvoiceHoldController } from './purchase-invoice-hold.controller';
import { AccountingRepository } from '../accounting/accounting.repository';

@Module({
  imports: [SalesModule, AccountingModule, CrmModule, InventoryModule, SettingsModule],
  controllers: [FinanceController, PurchaseInvoiceHoldController, LedgerHealthController, AdvanceController],
  providers: [FinanceService, FinanceRepository, AccountingRepository, PurchaseInvoiceHoldService, LedgerHealthService, AdvanceService],
  exports: [FinanceService],
})
export class FinanceModule {}