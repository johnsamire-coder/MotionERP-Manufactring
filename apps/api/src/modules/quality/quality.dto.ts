import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCheckPointDto {
  @IsString() @IsNotEmpty() relatedEntityType!: string;
  @IsUUID() relatedEntityId!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsInt() @Min(1) targetDurationMinutes!: number;
  @IsOptional() @IsInt() @Min(0) gracePeriodMinutes?: number;
  @IsOptional() @IsUUID() assignedRoleId?: string;
}

export class InitializeWorkflowDto {
  @IsUUID() checkPointId!: string;
}

export class ApproveRejectDto {
  @IsUUID() workflowId!: string;
  @IsOptional() @IsString() resultNote?: string;
}

export class CreateSlaRuleDto {
  @IsUUID() checkPointId!: string;
  @IsInt() @Min(0) escalationLevel!: number;
  @IsInt() @Min(0) delayMinutesAfterTarget!: number;
  @IsUUID() assignToRoleId!: string;
  @IsOptional() @IsString() notificationTemplate?: string;
}
