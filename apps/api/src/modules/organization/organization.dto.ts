import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from 'class-validator';

/**
 * Shape-level validation only (types, ranges, UUID format). All business rules
 * — parent-type rules, cycles, lifecycle — live in the service.
 *
 * `@IsOptional()` skips validation when a value is `null` or `undefined`, so
 * `parentId: null` is accepted and reaches the service as an explicit "make root".
 */
export class CreateOrgNodeDto {
  @IsString()
  @IsNotEmpty()
  nodeType!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

export class UpdateOrgNodeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
