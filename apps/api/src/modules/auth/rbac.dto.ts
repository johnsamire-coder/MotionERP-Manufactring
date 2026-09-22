// ============================================================
// Motion ERP — RBAC Permissions Matrix DTOs
// Step 95
// ============================================================
import { IsUUID, IsString, IsArray, IsBoolean, IsOptional } from 'class-validator';

export class UpdateRolePermissionsDto {
  @IsString() roleId!: string;
  @IsString() roleName!: string;
  @IsArray()  @IsString({ each: true }) permissions!: string[];
}

export class AssignUserRoleDto {
  @IsUUID()   userId!: string;
  @IsString() roleId!: string;
  @IsOptional() @IsString() reason?: string;
}