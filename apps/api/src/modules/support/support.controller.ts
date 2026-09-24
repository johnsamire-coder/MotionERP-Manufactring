import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { SupportExceptionFilter } from './support.exception-filter';
import { SupportService, type Priority, type TicketStatus } from './support.service';

export class HolidayDto { @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string; @IsOptional() @IsString() description?: string; }
export class HolidayListDto { @IsString() @MaxLength(100) name!: string; @IsArray() @ValidateNested({ each: true }) @Type(() => HolidayDto) holidays!: HolidayDto[]; }
export class WindowDto { @IsInt() @Min(0) @Max(6) weekday!: number; @IsString() start!: string; @IsString() end!: string; }
export class SlaDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() timeZone?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => WindowDto) workingHours!: WindowDto[];
  @IsOptional() @IsUUID() holidayListId?: string;
  @IsObject() priorities!: Record<string, { responseMinutes: number; resolutionMinutes: number }>;
  @IsOptional() @IsInt() @Min(1) autoCloseAfterDays?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
export class TicketDto {
  @IsString() @MaxLength(300) subject!: string;
  @IsOptional() @IsString() @MaxLength(10000) description?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsIn(['low', 'medium', 'high', 'urgent']) priority?: Priority;
  @IsOptional() @IsUUID() slaId?: string;
}
export class CommentDto { @IsIn(['agent', 'customer']) author!: 'agent' | 'customer'; @IsString() @MaxLength(10000) body!: string; }
export class StatusDto { @IsIn(['open', 'replied', 'on_hold', 'resolved', 'closed']) status!: TicketStatus; @IsOptional() @IsString() @MaxLength(500) reason?: string; }
export class SplitDto { @IsString() @MaxLength(300) subject!: string; @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) commentIds!: string[]; }

type Svc = SupportService;

@Controller({ path: 'support', version: '1' })
@UseFilters(SupportExceptionFilter)
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Post('holiday-lists') @HttpCode(201)
  async holidays(@Body() dto: HolidayListDto): Promise<{ id: string }> { return this.service.createHolidayList(dto.name, dto.holidays); }

  @Get('slas')
  async slas(): Promise<{ slas: Awaited<ReturnType<Svc['listSlas']>> }> { return { slas: await this.service.listSlas() }; }

  @Post('slas') @HttpCode(201)
  async sla(@Body() dto: SlaDto): Promise<{ sla: Awaited<ReturnType<Svc['createSla']>> }> { return { sla: await this.service.createSla(dto) }; }

  @Get('tickets')
  async tickets(@Query('status') status?: TicketStatus): Promise<{ tickets: Awaited<ReturnType<Svc['listTickets']>> }> { return { tickets: await this.service.listTickets(status) }; }

  @Post('tickets') @HttpCode(201)
  async create(@Body() dto: TicketDto): Promise<{ ticket: Awaited<ReturnType<Svc['createTicket']>> }> { return { ticket: await this.service.createTicket(dto) }; }

  @Get('tickets/:id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<{ ticket: Awaited<ReturnType<Svc['getTicket']>> }> { return { ticket: await this.service.getTicket(id) }; }

  @Post('tickets/:id/comments') @HttpCode(201)
  async comment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CommentDto): Promise<{ ticket: Awaited<ReturnType<Svc['comment']>> }> {
    return { ticket: await this.service.comment(id, dto.author, dto.body) };
  }

  @Post('tickets/:id/status') @HttpCode(200)
  async status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto): Promise<{ ticket: Awaited<ReturnType<Svc['setStatus']>> }> {
    return { ticket: await this.service.setStatus(id, dto.status, dto.reason) };
  }

  @Post('tickets/:id/split') @HttpCode(201)
  async split(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SplitDto): Promise<Awaited<ReturnType<Svc['split']>>> { return this.service.split(id, dto); }

  @Post('sweep') @HttpCode(200)
  async sweep(): Promise<Awaited<ReturnType<Svc['sweep']>>> { return this.service.sweep(); }

  @Get('sla-report')
  async report(): Promise<{ report: Awaited<ReturnType<Svc['slaReport']>> }> { return { report: await this.service.slaReport() }; }
}
