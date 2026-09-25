import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseFilters } from '@nestjs/common';
import { UpsertCompanyProfileDto } from './settings.dto';
import { SettingsExceptionFilter } from './settings.exception-filter';
import { SettingsService } from './settings.service';
import type { CompanyProfileRecord } from './settings.types';

@Controller({ path: 'settings', version: '1' })
@UseFilters(SettingsExceptionFilter)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('company-profile/:orgNodeId')
  async companyProfile(
    @Param('orgNodeId', ParseUUIDPipe) orgNodeId: string,
  ): Promise<{ companyProfile: CompanyProfileRecord }> {
    return { companyProfile: await this.service.getCompanyProfile(orgNodeId) };
  }

  @Put('company-profile/:orgNodeId')
  async upsertCompanyProfile(
    @Param('orgNodeId', ParseUUIDPipe) orgNodeId: string,
    @Body() dto: UpsertCompanyProfileDto,
  ): Promise<{ companyProfile: CompanyProfileRecord }> {
    return { companyProfile: await this.service.upsertCompanyProfile(orgNodeId, dto) };
  }
}
