import { SalesSerialLinkController } from './sales-serial-link.controller';
import { SalesSerialLinkService } from './sales-serial-link.service';
import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { SalesController } from './sales.controller';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';
import { CustomerCreditRepository } from './customer-credit.repository';
import { CustomerCreditService } from './customer-credit.service';

@Module({
  imports: [CrmModule],
  controllers: [SalesSerialLinkController, SalesController],
  providers: [SalesSerialLinkService, SalesService, SalesRepository, CustomerCreditService, CustomerCreditRepository],
  exports: [SalesService, CustomerCreditService],
})
export class SalesModule {}
