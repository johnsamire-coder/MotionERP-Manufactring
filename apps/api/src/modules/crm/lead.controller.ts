import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CrmExceptionFilter } from './crm.exception-filter';
import type { CustomerRecord } from './crm.types';
import { LeadService, type LeadAction } from './lead.service';
import type { LeadActivityType, LeadRecord, LeadStatus, ProspectRecord } from './lead.types';

export class CreateLeadDto {
  @IsString() @MaxLength(200) personName!: string;
  @IsOptional() @IsString() @MaxLength(200) companyName?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(100) source?: string;
  @IsUUID() orgNodeId!: string;
}
export class LeadActivityDto {
  @IsIn(['call', 'visit', 'email', 'note']) activityType!: LeadActivityType;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
  @IsOptional() @IsString() activityDate?: string;
}
export class LeadActionDto {
  @IsIn(['interested', 'lost', 'do_not_contact', 'reopen']) action!: LeadAction;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
export class ConvertDto {
  @IsString() @MaxLength(64) code!: string;
  @IsOptional() @IsNumberString() creditLimit?: string;
}
export class CreateProspectDto {
  @IsString() @MaxLength(200) companyName!: string;
  @IsOptional() @IsString() @MaxLength(100) industry?: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) leadIds!: string[];
}
export class ProspectLeadDto {
  @IsUUID() leadId!: string;
}
export class LoseDto {
  @IsString() @MaxLength(500) reason!: string;
}

@Controller({ path: 'crm', version: '1' })
@UseFilters(CrmExceptionFilter)
export class LeadController {
  constructor(private readonly service: LeadService) {}

  @Get('leads')
  async leads(@Query('status') status?: LeadStatus): Promise<{ leads: LeadRecord[] }> {
    return { leads: await this.service.listLeads(status) };
  }

  @Get('leads/:id')
  async lead(@Param('id', ParseUUIDPipe) id: string): Promise<{ lead: LeadRecord }> {
    return { lead: await this.service.getLead(id) };
  }

  @Post('leads')
  @HttpCode(201)
  async createLead(@Body() dto: CreateLeadDto): Promise<{ lead: LeadRecord }> {
    return { lead: await this.service.createLead(dto) };
  }

  @Post('leads/:id/activities')
  @HttpCode(201)
  async activity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeadActivityDto,
  ): Promise<{ lead: LeadRecord }> {
    return {
      lead: await this.service.logActivity(id, dto.activityType, dto.note, dto.activityDate),
    };
  }

  @Post('leads/:id/action')
  @HttpCode(200)
  async action(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeadActionDto,
  ): Promise<{ lead: LeadRecord }> {
    return { lead: await this.service.act(id, dto.action, dto.reason) };
  }

  @Post('leads/:id/convert')
  @HttpCode(200)
  async convertLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertDto,
  ): Promise<{ lead: LeadRecord; customer: CustomerRecord }> {
    return this.service.convertLead(id, dto);
  }

  @Get('prospects')
  async prospects(): Promise<{ prospects: ProspectRecord[] }> {
    return { prospects: await this.service.listProspects() };
  }

  @Get('prospects/:id')
  async prospect(@Param('id', ParseUUIDPipe) id: string): Promise<{ prospect: ProspectRecord }> {
    return { prospect: await this.service.getProspect(id) };
  }

  @Post('prospects')
  @HttpCode(201)
  async createProspect(@Body() dto: CreateProspectDto): Promise<{ prospect: ProspectRecord }> {
    return { prospect: await this.service.createProspect(dto) };
  }

  @Post('prospects/:id/leads')
  @HttpCode(200)
  async addLead(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProspectLeadDto,
  ): Promise<{ prospect: ProspectRecord }> {
    return { prospect: await this.service.addLeadToProspect(id, dto.leadId) };
  }

  @Post('prospects/:id/convert')
  @HttpCode(200)
  async convertProspect(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertDto,
  ): Promise<{ prospect: ProspectRecord; customer: CustomerRecord }> {
    return this.service.convertProspect(id, dto);
  }

  @Post('prospects/:id/lost')
  @HttpCode(200)
  async lose(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LoseDto,
  ): Promise<{ prospect: ProspectRecord }> {
    return { prospect: await this.service.loseProspect(id, dto.reason) };
  }
}
