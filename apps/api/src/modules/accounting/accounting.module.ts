import { OpeningEntriesService } from './opening-entries.service';
import { OpeningEntriesController } from './opening-entries.controller';
import { FiscalYearClosingService } from './fiscal-year-closing.service';
import { FiscalYearClosingController } from './fiscal-year-closing.controller';
import { PeriodClosingService } from './period-closing.service';
import { PeriodClosingController } from './period-closing.controller';
import { TaxAndCustomsService } from './tax-customs.service';
import { TaxAndCustomsController } from './tax-customs.controller';
import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingRepository } from './accounting.repository';
import { AccountingService } from './accounting.service';
import { PostingEngineService } from './posting-engine.service';

@Module({
  controllers: [OpeningEntriesController, FiscalYearClosingController, PeriodClosingController, TaxAndCustomsController, AccountingController],
  providers: [OpeningEntriesService, FiscalYearClosingService, PeriodClosingService, TaxAndCustomsService, AccountingService, AccountingRepository, PostingEngineService],
  exports: [AccountingService, PostingEngineService],
})
export class AccountingModule {}