import { IsOptional, IsString } from 'class-validator';

export class UpsertCompanyProfileDto {
  @IsOptional() @IsString() displayName?: string | null;
  @IsOptional() @IsString() logoUrl?: string | null;
}
