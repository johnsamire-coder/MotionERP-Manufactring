import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseFilters } from '@nestjs/common';
import { ApproveRejectDto, CreateCheckPointDto, CreateSlaRuleDto, InitializeWorkflowDto } from './quality.dto';
import { QualityExceptionFilter } from './quality.exception-filter';
import { QualityService } from './quality.service';
import type { QualityCheckPointRecord, QualityWorkflowRecord, SlaRuleRecord } from './quality.types';

@Controller({ path: 'quality', version: '1' })
@UseFilters(QualityExceptionFilter)
export class QualityController {
  constructor(private readonly service: QualityService) {}

  @Post('check-points') @HttpCode(201)
  async createCheckPoint(@Body() dto: CreateCheckPointDto): Promise<{ checkPoint: QualityCheckPointRecord }> {
    const created = await this.service.createCheckPoint({
      relatedEntityType: dto.relatedEntityType as any,
      relatedEntityId: dto.relatedEntityId,
      name: dto.name,
      targetDurationMinutes: dto.targetDurationMinutes,
      gracePeriodMinutes: dto.gracePeriodMinutes,
      assignedRoleId: dto.assignedRoleId
    });
    return { checkPoint: created };
  }

  @Post('workflows/initialize') @HttpCode(201)
  async initializeWorkflow(@Body() dto: InitializeWorkflowDto): Promise<{ workflow: QualityWorkflowRecord }> {
    const workflow = await this.service.initializeWorkflow(dto.checkPointId);
    return { workflow };
  }

  @Post('workflows/:id/approve') @HttpCode(200)
  async approveCheckPoint(
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Body() dto: ApproveRejectDto
  ): Promise<{ workflow: QualityWorkflowRecord }> {
    const workflow = await this.service.approveCheckPoint(workflowId, 'system-user', dto.resultNote);
    return { workflow };
  }

  @Post('workflows/:id/reject') @HttpCode(200)
  async rejectCheckPoint(
    @Param('id', ParseUUIDPipe) workflowId: string,
    @Body() dto: ApproveRejectDto
  ): Promise<{ workflow: QualityWorkflowRecord }> {
    const workflow = await this.service.rejectCheckPoint(workflowId, 'system-user', dto.resultNote);
    return { workflow };
  }

  @Post('sla-rules') @HttpCode(201)
  async createSlaRule(@Body() dto: CreateSlaRuleDto): Promise<{ rule: SlaRuleRecord }> {
    const rule = await this.service.createSlaRule({
      checkPointId: dto.checkPointId,
      escalationLevel: dto.escalationLevel,
      delayMinutesAfterTarget: dto.delayMinutesAfterTarget,
      assignToRoleId: dto.assignToRoleId,
      notificationTemplate: dto.notificationTemplate
    });
    return { rule };
  }

  @Post('process-overdue') @HttpCode(200)
  async processOverdue(): Promise<{ processed: number }> {
    const processed = await this.service.processOverdueWorkflows();
    return { processed };
  }
}
