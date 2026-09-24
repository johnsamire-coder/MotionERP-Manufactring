import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, UseFilters } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { EgyptEinvoiceService, EgyptNotFoundError, EgyptValidationError } from './egypt-einvoice.service';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }
@Catch(EgyptNotFoundError, EgyptValidationError)
export class EgyptExceptionFilter implements ExceptionFilter {
  catch(e: Error, host: ArgumentsHost): void {
    const status = e instanceof EgyptNotFoundError ? 404 : 400;
    host.switchToHttp().getResponse<HttpResponse>().status(status).json({ statusCode: status, message: e.message });
  }
}

export class AddressDto {
  @IsOptional() @IsString() branchID?: string;
  @IsString() @MaxLength(2) country!: string;
  @IsString() governate!: string;
  @IsString() regionCity!: string;
  @IsString() street!: string;
  @IsString() buildingNumber!: string;
}
export class IssuerDto {
  @IsUUID() orgNodeId!: string;
  @Matches(/^\d{9}$/) rin!: string;
  @IsString() @MaxLength(200) name!: string;
  @Matches(/^\d{4}$/) activityCode!: string;
  @ValidateNested() @Type(() => AddressDto) address!: AddressDto;
  @IsOptional() @IsIn(['0.9', '1.0']) documentVersion?: '0.9' | '1.0';
}
export class PartyDto {
  @IsIn(['B', 'P', 'F']) receiverType!: 'B' | 'P' | 'F';
  @IsOptional() @IsString() taxId?: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
}
export class ItemCodeDto {
  @IsOptional() @IsIn(['EGS', 'GS1']) itemType?: 'EGS' | 'GS1';
  @IsString() @MaxLength(100) itemCode!: string;
  @IsOptional() @IsString() unitType?: string;
  @IsOptional() @IsString() taxSubType?: string;
}
export class SignatureDto { @IsString() signature!: string; }

type Svc = EgyptEinvoiceService;

/** Egyptian e-invoicing (plan item 48) — a separate regional layer. */
@Controller({ path: 'regional/eg', version: '1' })
@UseFilters(EgyptExceptionFilter)
export class EgyptEinvoiceController {
  constructor(private readonly service: EgyptEinvoiceService) {}

  @Put('issuer')
  async issuer(@Body() dto: IssuerDto): Promise<{ issuer: Awaited<ReturnType<Svc['setIssuer']>> }> {
    return { issuer: await this.service.setIssuer({ ...dto, address: { ...dto.address, branchID: dto.address.branchID ?? '0' } }) };
  }

  @Put('customers/:customerId')
  async party(@Param('customerId', ParseUUIDPipe) id: string, @Body() dto: PartyDto): Promise<{ profile: Awaited<ReturnType<Svc['setParty']>> }> {
    return { profile: await this.service.setParty(id, { ...dto, taxId: dto.taxId ?? null, address: dto.address ?? null }) };
  }

  @Put('items/:itemId')
  async item(@Param('itemId', ParseUUIDPipe) id: string, @Body() dto: ItemCodeDto): Promise<{ code: Awaited<ReturnType<Svc['setItemCode']>> }> {
    return { code: await this.service.setItemCode(id, dto) };
  }

  @Get('documents')
  async documents(): Promise<{ documents: Awaited<ReturnType<Svc['list']>> }> { return { documents: await this.service.list() }; }

  @Post('invoices/:salesInvoiceId/prepare') @HttpCode(200)
  async prepare(@Param('salesInvoiceId', ParseUUIDPipe) id: string): Promise<{ document: Awaited<ReturnType<Svc['prepare']>> }> { return { document: await this.service.prepare(id) }; }

  @Post('invoices/:salesInvoiceId/signature') @HttpCode(200)
  async sign(@Param('salesInvoiceId', ParseUUIDPipe) id: string, @Body() dto: SignatureDto): Promise<{ document: Awaited<ReturnType<Svc['attachSignature']>> }> {
    return { document: await this.service.attachSignature(id, dto.signature) };
  }

  @Post('invoices/:salesInvoiceId/submit') @HttpCode(200)
  async submit(@Param('salesInvoiceId', ParseUUIDPipe) id: string): Promise<{ document: Awaited<ReturnType<Svc['submit']>> }> { return { document: await this.service.submit(id) }; }
}
