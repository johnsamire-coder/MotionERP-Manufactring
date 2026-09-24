// ============================================================
// Motion ERP — Audit Trail DTOs
// Step 94
// ============================================================
import { IsUUID, IsString, IsOptional } from 'class-validator';

export class RecordAuditLogDto {
  @IsString() entityName!: string;
  @IsString() entityId!: string;
  /** CREATE, UPDATE, DELETE, or the action on a record (POST, RECEIVE, CANCEL, …). */
  @IsString() action!: string;
  @IsOptional() @IsUUID() performedBy?: string;
  @IsOptional() @IsString() performedByName?: string;
  @IsOptional() @IsUUID() companyId?: string;
  @IsOptional() @IsString() ipAddress?: string;
  @IsOptional() @IsString() userAgent?: string;
  @IsOptional() @IsString() oldValues?: string;
  @IsOptional() @IsString() newValues?: string;
  @IsOptional() @IsString() details?: string;
}

export class QueryAuditLogsDto {
  @IsOptional() @IsString() entityName?: string;
  @IsOptional() @IsString() action?: string;
  @IsOptional() @IsUUID() performedBy?: string;
  @IsOptional() @IsUUID() companyId?: string;
}
