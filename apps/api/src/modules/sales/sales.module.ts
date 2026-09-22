import { SalesSerialLinkController } from './sales-serial-link.controller';
import { SalesSerialLinkService } from './sales-serial-link.service';
import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { SalesController } from './sales.controller';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

@Module({
  imports: [CrmModule],
  controllers: [SalesSerialLinkController, SalesController],
  providers: [SalesSerialLinkService, SalesService, SalesRepository],
  exports: [SalesService],
})
export class SalesModule {}
