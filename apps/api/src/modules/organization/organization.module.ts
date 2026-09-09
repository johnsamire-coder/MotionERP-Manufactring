import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationRepository } from './organization.repository';
import { OrganizationService } from './organization.service';

/**
 * Organizational core (D10): the generic node tree every other module anchors to.
 * Phase B-2-2 exposes a single read endpoint.
 */
@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepository],
})
export class OrganizationModule {}
