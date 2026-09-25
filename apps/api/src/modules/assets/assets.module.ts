import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { HrModule } from '../hr/hr.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AssetLifecycleService } from './asset-lifecycle.service';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';

/** Fixed assets (plan items 46 / 49). */
@Module({
  imports: [AccountingModule, HrModule, InventoryModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetLifecycleService],
  exports: [AssetsService],
})
export class AssetsModule {}
