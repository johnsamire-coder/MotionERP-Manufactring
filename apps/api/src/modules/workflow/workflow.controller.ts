import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { WorkflowExceptionFilter } from './workflow.exception-filter';
import { WorkflowService, type AvailableAction, type InstanceView } from './workflow.service';

export class StateDto { @IsString() @MaxLength(64) code!: string; @IsString() @MaxLength(200) name!: string; @IsOptional() @IsBoolean() isFinal?: boolean; }
export class TransitionDto {
  @IsString() fromState!: string;
  @IsString() toState!: string;
  @IsString() @MaxLength(64) action!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedRoles?: string[];
  @IsOptional() @IsObject() condition?: Record<string, unknown>;
}
export class CreateWorkflowDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(64) documentType!: string;
  @IsString() initialState!: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => StateDto) states!: StateDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => TransitionDto) transitions!: TransitionDto[];
}
export class StartDto { @IsString() documentType!: string; @IsUUID() documentId!: string; @IsOptional() @IsObject() context?: Record<string, unknown>; }
export class ActDto { @IsString() action!: string; @IsOptional() @IsString() @MaxLength(1000) comment?: string; @IsOptional() @IsObject() context?: Record<string, unknown>; }
export class ContextDto { @IsOptional() @IsObject() context?: Record<string, unknown>; }

@Controller({ path: 'workflow', version: '1' })
@UseFilters(WorkflowExceptionFilter)
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Get('definitions')
  async definitions(): Promise<{ definitions: Awaited<ReturnType<WorkflowService['listDefinitions']>> }> { return { definitions: await this.service.listDefinitions() }; }

  @Post('definitions') @HttpCode(201)
  async create(@Body() dto: CreateWorkflowDto): Promise<{ id: string }> { return this.service.createDefinition(dto); }

  @Post('instances') @HttpCode(201)
  async start(@Body() dto: StartDto): Promise<{ instance: InstanceView }> { return { instance: await this.service.start(dto.documentType, dto.documentId, dto.context) }; }

  @Get('instances')
  async byDocument(@Query('documentType') documentType: string, @Query('documentId', ParseUUIDPipe) documentId: string): Promise<{ instance: InstanceView }> {
    return { instance: await this.service.findByDocument(documentType, documentId) };
  }

  @Post('instances/:id/available-actions') @HttpCode(200)
  async actions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ContextDto): Promise<{ actions: AvailableAction[] }> {
    return { actions: await this.service.availableActions(id, dto.context) };
  }

  @Post('instances/:id/act') @HttpCode(200)
  async act(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ActDto): Promise<{ instance: InstanceView }> {
    return { instance: await this.service.act(id, dto.action, dto) };
  }
}
