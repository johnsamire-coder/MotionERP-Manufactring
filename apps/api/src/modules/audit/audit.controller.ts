// ============================================================
// Motion ERP — Audit Trail Controller
// Step 94 | REST APIs
// ============================================================
import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RecordAuditLogDto, QueryAuditLogsDto } from './audit.dto';

@Controller({ path: 'audit', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post('log')
  async logAction(@Body() dto: RecordAuditLogDto) {
    return this.auditService.logAction(dto);
  }

  @Get('logs')
  async queryLogs(@Query() query: QueryAuditLogsDto) {
    return this.auditService.queryLogs(query);
  }

  @Get('history/:entityName/:entityId')
  async getEntityHistory(
    @Param('entityName') entityName: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getEntityHistory(entityName, entityId);
  }
}
