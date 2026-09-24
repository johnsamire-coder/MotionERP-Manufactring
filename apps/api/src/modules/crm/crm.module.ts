import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
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
  controllers: [
    ContactController,
    CrmController,
    OpportunityController,
    LeadController,
    PartyGroupController,
  ],
  providers: [
    ContactService,
    CrmService,
    CrmRepository,
    OpportunityService,
    OpportunityRepository,
    LeadService,
    LeadRepository,
    PartyGroupService,
  ],
  exports: [ContactService, CrmService, OpportunityService, PartyGroupService],
})
export class CrmModule {}
