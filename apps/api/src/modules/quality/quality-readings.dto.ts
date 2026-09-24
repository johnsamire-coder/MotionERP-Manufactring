import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TemplateParameterDto {
  @IsString() @MaxLength(200) parameterName!: string;
  @IsBoolean() isNumeric!: boolean;
  @IsOptional() @IsNumberString() minValue?: string;
  @IsOptional() @IsNumberString() maxValue?: string;
  @IsOptional() @IsString() @MaxLength(200) acceptedValue?: string;
  @IsOptional() @IsInt() @Min(1) @Max(10) readingsRequired?: number;
}

export class CreateInspectionTemplateDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsUUID() itemId?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TemplateParameterDto)
  parameters!: TemplateParameterDto[];
}

export class CreateInspectionFromTemplateDto {
  @IsUUID() templateId!: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsUUID() itemId?: string;
  @IsIn(['purchase_receipt', 'production_step', 'delivery_order']) referenceType!:
    'purchase_receipt' | 'production_step' | 'delivery_order';
  @IsUUID() referenceId!: string;
  @IsOptional() @IsString() notes?: string;
}

export class ParameterReadingsDto {
  @IsUUID() parameterId!: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) values!: string[];
}

export class RecordReadingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParameterReadingsDto)
  readings!: ParameterReadingsDto[];
  @IsOptional() @IsString() notes?: string;
}
