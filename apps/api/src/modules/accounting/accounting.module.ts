import { TaxAndCustomsService } from './tax-customs.service';
import { TaxAndCustomsController } from './tax-customs.controller';
import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingRepository } from './accounting.repository';
import { AccountingService } from './accounting.service';
import { PostingEngineService } from './posting-engine.service';

@Module({
  controllers: [TaxAndCustomsController, AccountingController],
  providers: [TaxAndCustomsService, AccountingService, AccountingRepository, PostingEngineService],
  exports: [AccountingService, PostingEngineService],
})
export class AccountingModule {}