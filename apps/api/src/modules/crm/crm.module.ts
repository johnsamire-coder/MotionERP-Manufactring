import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmRepository } from './crm.repository';
import { CrmService } from './crm.service';
import { OpportunityController } from './opportunity.controller';
import { OpportunityRepository } from './opportunity.repository';
import { OpportunityService } from './opportunity.service';

@Module({
  controllers: [CrmController, OpportunityController],
  providers: [CrmService, CrmRepository, OpportunityService, OpportunityRepository],
  exports: [CrmService, OpportunityService],
})
export class CrmModule {}
