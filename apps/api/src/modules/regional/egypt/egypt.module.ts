import { Module } from '@nestjs/common';
import { CatalogModule } from '../../catalog/catalog.module';
import { FinanceModule } from '../../finance/finance.module';
import { EgyptEinvoiceController } from './egypt-einvoice.controller';
import { EgyptEinvoiceService } from './egypt-einvoice.service';

/** Regional layer — Egypt (plan item 48): e-invoicing with the Egyptian Tax Authority. */
@Module({
  imports: [FinanceModule, CatalogModule],
  controllers: [EgyptEinvoiceController],
  providers: [EgyptEinvoiceService],
})
export class RegionalEgyptModule {}
