import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import type { DeliveryStatus, InstallationStatus } from './delivery.types';

export class CreateDeliveryOrderDto {
  @IsString() @IsNotEmpty() jobOrderReference!: string;
  @IsDateString() scheduledDate!: string;
  @IsOptional() @IsString() @MaxLength(20) vehiclePlate?: string;
  @IsOptional() @IsString() @MaxLength(100) driverName?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateDeliveryOrderDto {
  @IsOptional() @IsDateString() actualDate?: string;
  @IsOptional()
  @IsIn(['scheduled', 'in_transit', 'delivered', 'cancelled'])
  status?: DeliveryStatus;
  @IsOptional() @IsString() @MaxLength(20) vehiclePlate?: string;
  @IsOptional() @IsString() @MaxLength(100) driverName?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateInstallationDto {
  @IsUUID() deliveryOrderId!: string;
  @IsDateString() scheduledDate!: string;
  @IsOptional() @IsString() @MaxLength(200) technicianNames?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateInstallationDto {
  @IsOptional() @IsDateString() actualStartDate?: string;
  @IsOptional() @IsDateString() actualEndDate?: string;
  @IsOptional()
  @IsIn(['scheduled', 'in_progress', 'completed', 'cancelled'])
  status?: InstallationStatus;
  @IsOptional() @IsString() @MaxLength(200) technicianNames?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateDeliveryReceiptDto {
  @IsUUID() deliveryOrderId!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) signedBy!: string;
  @IsOptional() @IsString() signatureImage?: string;
  @IsOptional() @IsString() receivedItems?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateInstallationReportDto {
  @IsUUID() installationId!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) performedBy!: string;
  @IsOptional() @IsString() @MaxLength(100) verifiedBy?: string;
  @IsOptional() @IsString() completionNotes?: string;
  @IsOptional() @IsString() issuesFound?: string;
  @IsOptional() @IsString() correctiveActions?: string;
}
