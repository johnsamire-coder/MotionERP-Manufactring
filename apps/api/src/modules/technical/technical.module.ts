import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { TechnicalController } from './technical.controller';
import { TechnicalRepository } from './technical.repository';
import { TechnicalService } from './technical.service';

@Module({
  imports: [SalesModule],
  controllers: [TechnicalController],
  providers: [TechnicalService, TechnicalRepository],
  exports: [TechnicalService],
})
export class TechnicalModule {}
