// ============================================================
// Motion ERP — Audit Trail Service
// Step 94 | Tamper-proof Activity Logging Engine
// ============================================================
import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { auditLog, AuditLogRecord, NewAuditLogRecord } from './audit.schema';
import { RecordAuditLogDto, QueryAuditLogsDto } from './audit.dto';

@Injectable()
export class AuditService {
  constructor(@Inject('DRIZZLE') private readonly db: any) {}

  // ── تسجيل حركة رقابية جديدة ──────────────────
  async logAction(dto: RecordAuditLogDto): Promise<AuditLogRecord> {
    const record: NewAuditLogRecord = {
      entityName: dto.entityName,
      entityId: dto.entityId,
      action: dto.action,
      performedBy: dto.performedBy || null,
      performedByName: dto.performedByName || 'مستخدم النظام',
      companyId: dto.companyId || null,
      ipAddress: dto.ipAddress || '127.0.0.1',
      userAgent: dto.userAgent || 'Motion-ERP-Client',
      oldValues: dto.oldValues || null,
      newValues: dto.newValues || null,
      details: dto.details || null,
    };

    const [inserted] = await this.db
      .insert(auditLog)
      .values(record)
      .returning();

    return inserted;
  }

  // ── الاستعلام عن سجلات التدقيق ──────────────
  async queryLogs(query: QueryAuditLogsDto): Promise<AuditLogRecord[]> {
    const conditions = [];
    if (query.entityName) conditions.push(eq(auditLog.entityName, query.entityName));
    if (query.action) conditions.push(eq(auditLog.action, query.action));
    if (query.performedBy) conditions.push(eq(auditLog.performedBy, query.performedBy));
    if (query.companyId) conditions.push(eq(auditLog.companyId, query.companyId));

    return this.db
      .select()
      .from(auditLog)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(100);
  }

  // ── التاريخ الزمني لسجل محدد (Entity History) ─
  async getEntityHistory(entityName: string, entityId: string): Promise<AuditLogRecord[]> {
    return this.db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.entityName, entityName),
          eq(auditLog.entityId, entityId),
        ),
      )
      .orderBy(desc(auditLog.createdAt));
  }
}