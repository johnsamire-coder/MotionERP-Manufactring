import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { YearEndClosingController } from './year-end-closing.controller';
import { YearEndClosingService } from './year-end-closing.service';
import { AccountRolesController } from './account-roles.controller';
import { JournalReversalController } from './journal-reversal.controller';
import { JournalReversalService } from './journal-reversal.service';
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
  controllers: [OpeningEntriesController, FiscalYearClosingController, PeriodClosingController, TaxAndCustomsController, AccountingController, JournalReversalController, AccountRolesController, YearEndClosingController, BudgetController],
  providers: [OpeningEntriesService, FiscalYearClosingService, PeriodClosingService, TaxAndCustomsService, AccountingService, AccountingRepository, PostingEngineService, JournalReversalService, YearEndClosingService, BudgetService],
  exports: [AccountingService, PostingEngineService, JournalReversalService],
})
export class AccountingModule {}