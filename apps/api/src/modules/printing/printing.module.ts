import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { FinanceModule } from '../finance/finance.module';
import { SettingsModule } from '../settings/settings.module';
import { PrintingController } from './printing.controller';
import { PrintJobService } from './print-job.service';
import { PrintingService } from './printing.service';

/** Generic print system (plan item 47). */
@Module({
  imports: [FinanceModule, SettingsModule, CatalogModule],
  controllers: [PrintingController],
  providers: [PrintingService, PrintJobService],
  exports: [PrintingService, PrintJobService],
})
export class PrintingModule {}
