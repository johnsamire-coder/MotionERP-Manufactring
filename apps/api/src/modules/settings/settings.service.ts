import { Injectable } from '@nestjs/common';
import { OrganizationService } from '../organization/organization.service';
import { SettingsValidationError } from './settings.errors';
import { SettingsRepository } from './settings.repository';
import type { CompanyProfileRecord, UpsertCompanyProfileInput } from './settings.types';

@Injectable()
export class SettingsService {
  constructor(
    private readonly repository: SettingsRepository,
    private readonly organizationService: OrganizationService,
  ) {}

  async getCompanyProfile(orgNodeId: string): Promise<CompanyProfileRecord> {
    const node = await this.organizationService.getNode(orgNodeId);
    if (node.nodeType !== 'legal_company') {
      throw new SettingsValidationError(`org node ${orgNodeId} is a "${node.nodeType}", not a "legal_company"; company profile only applies to legal companies`);
    }
    const existing = await this.repository.findByOrgNodeId(orgNodeId);
    return existing ?? { id: '', orgNodeId, displayName: null, logoUrl: null };
  }

  async upsertCompanyProfile(orgNodeId: string, input: UpsertCompanyProfileInput): Promise<CompanyProfileRecord> {
    const node = await this.organizationService.getNode(orgNodeId);
    if (node.nodeType !== 'legal_company') {
      throw new SettingsValidationError(`org node ${orgNodeId} is a "${node.nodeType}", not a "legal_company"; company profile only applies to legal companies`);
    }
    return this.repository.upsert(orgNodeId, input);
  }
}
