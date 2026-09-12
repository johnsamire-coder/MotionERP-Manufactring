import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { FinanceController } from './finance.controller';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';

@Module({
  imports: [SalesModule],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceRepository],
  exports: [FinanceService],
})
export class FinanceModule {}
