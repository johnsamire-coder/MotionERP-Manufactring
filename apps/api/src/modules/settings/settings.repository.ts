import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../core/database/database.service';
import { companyProfile } from './settings.schema';
import type { CompanyProfileRecord, UpsertCompanyProfileInput } from './settings.types';

const cpColumns = {
  id: companyProfile.id,
  orgNodeId: companyProfile.orgNodeId,
  displayName: companyProfile.displayName,
  logoUrl: companyProfile.logoUrl,
};

@Injectable()
export class SettingsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findByOrgNodeId(orgNodeId: string): Promise<CompanyProfileRecord | null> {
    const rows = await this.database.db
      .select(cpColumns)
      .from(companyProfile)
      .where(eq(companyProfile.orgNodeId, orgNodeId))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsert(orgNodeId: string, input: UpsertCompanyProfileInput): Promise<CompanyProfileRecord> {
    const existing = await this.findByOrgNodeId(orgNodeId);
    if (existing) {
      const rows = await this.database.db
        .update(companyProfile)
        .set({
          displayName: input.displayName === undefined ? existing.displayName : input.displayName,
          logoUrl: input.logoUrl === undefined ? existing.logoUrl : input.logoUrl,
        })
        .where(eq(companyProfile.orgNodeId, orgNodeId))
        .returning(cpColumns);
      return rows[0]!;
    }
    const rows = await this.database.db
      .insert(companyProfile)
      .values({
        orgNodeId,
        displayName: input.displayName ?? null,
        logoUrl: input.logoUrl ?? null,
      })
      .returning(cpColumns);
    return rows[0]!;
  }
}
