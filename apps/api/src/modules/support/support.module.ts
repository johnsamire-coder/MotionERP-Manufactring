import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

/** Helpdesk (plan item 43). */
@Module({
  imports: [CrmModule],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
