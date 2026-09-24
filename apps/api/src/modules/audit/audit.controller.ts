// ============================================================
// Motion ERP — Audit Trail Controller
// Step 94 | REST APIs
// ============================================================
import { Controller, Get, Query, Param } from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './audit.dto';

/**
 * Read-only: entries are written by AuditInterceptor for every successful change, never by clients
 * (the old POST audit/log let anyone write any entry).
 */
@Controller({ path: 'audit', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

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
