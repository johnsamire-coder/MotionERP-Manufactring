import { SalesSerialLinkController } from './sales-serial-link.controller';
import { SalesSerialLinkService } from './sales-serial-link.service';
import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CrmModule } from '../crm/crm.module';
import { RfqController } from './rfq.controller';
import { RfqRepository } from './rfq.repository';
import { RfqService } from './rfq.service';
import { SalesController } from './sales.controller';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';
import { CustomerCreditRepository } from './customer-credit.repository';
import { CustomerCreditService } from './customer-credit.service';

@Module({
  imports: [CrmModule, CatalogModule],
  controllers: [SalesSerialLinkController, SalesController, RfqController],
  providers: [SalesSerialLinkService, SalesService, SalesRepository, CustomerCreditService, CustomerCreditRepository, RfqService, RfqRepository],
  exports: [SalesService, CustomerCreditService],
})
export class SalesModule {}
