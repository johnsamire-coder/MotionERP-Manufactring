import { Module } from '@nestjs/common';
import { CrmController } from './crm.controller';
import { CrmRepository } from './crm.repository';
import { CrmService } from './crm.service';
import { LeadController } from './lead.controller';
import { LeadRepository } from './lead.repository';
import { LeadService } from './lead.service';
import { PartyGroupController } from './party-group.controller';
import { PartyGroupService } from './party-group.service';
import { OpportunityController } from './opportunity.controller';
import { OpportunityRepository } from './opportunity.repository';
import { OpportunityService } from './opportunity.service';

@Module({
  controllers: [CrmController, OpportunityController, LeadController, PartyGroupController],
  providers: [
    CrmService,
    CrmRepository,
    OpportunityService,
    OpportunityRepository,
    LeadService,
    LeadRepository,
    PartyGroupService,
  ],
  exports: [CrmService, OpportunityService, PartyGroupService],
})
export class CrmModule {}
