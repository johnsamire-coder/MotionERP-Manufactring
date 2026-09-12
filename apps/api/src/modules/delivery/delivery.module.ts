import { Module } from '@nestjs/common';
import { SalesModule } from '../sales/sales.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryRepository } from './delivery.repository';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [SalesModule],
  controllers: [DeliveryController],
  providers: [DeliveryService, DeliveryRepository],
  exports: [DeliveryService],
})
export class DeliveryModule {}
