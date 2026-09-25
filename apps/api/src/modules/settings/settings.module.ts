import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';
import { PurchaseAllowanceService } from './purchase-allowance.service';
import { PurchaseAllowanceController } from './purchase-allowance.controller';

@Module({
  imports: [OrganizationModule],
  controllers: [SettingsController, PurchaseAllowanceController],
  providers: [SettingsService, SettingsRepository, PurchaseAllowanceService],
  exports: [SettingsService, PurchaseAllowanceService],
})
export class SettingsModule {}
