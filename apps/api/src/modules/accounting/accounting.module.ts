import { AccountControlsController } from './account-controls.controller';
import { AccountControlsService } from './account-controls.service';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { YearEndClosingController } from './year-end-closing.controller';
import { YearEndClosingService } from './year-end-closing.service';
import { AccountRolesController } from './account-roles.controller';
import { JournalReversalController } from './journal-reversal.controller';
import { JournalReversalService } from './journal-reversal.service';
import { TaxAndCustomsService } from './tax-customs.service';
import { TaxAndCustomsController } from './tax-customs.controller';
import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingRepository } from './accounting.repository';
import { AccountingService } from './accounting.service';
import { PostingEngineService } from './posting-engine.service';

@Module({
  controllers: [
    TaxAndCustomsController,
    AccountingController,
    JournalReversalController,
    AccountRolesController,
    YearEndClosingController,
    BudgetController,
    AccountControlsController,
  ],
  providers: [
    TaxAndCustomsService,
    AccountingService,
    AccountingRepository,
    PostingEngineService,
    JournalReversalService,
    YearEndClosingService,
    BudgetService,
    AccountControlsService,
  ],
  exports: [
    AccountingService,
    PostingEngineService,
    JournalReversalService,
    AccountControlsService,
  ],
})
export class AccountingModule {}
