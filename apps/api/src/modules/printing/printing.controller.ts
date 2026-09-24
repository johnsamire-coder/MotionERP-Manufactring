import { ArgumentsHost, Body, Catch, Controller, ExceptionFilter, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query, UseFilters } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { PrintJobService } from './print-job.service';
import { PrintingNotFoundError, PrintingService, PrintingValidationError } from './printing.service';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }
@Catch(PrintingNotFoundError, PrintingValidationError)
export class PrintingExceptionFilter implements ExceptionFilter {
  catch(e: Error, host: ArgumentsHost): void {
    const status = e instanceof PrintingNotFoundError ? 404 : 400;
    host.switchToHttp().getResponse<HttpResponse>().status(status).json({ statusCode: status, message: e.message });
  }
}

export class LetterheadDto {
  @IsUUID() orgNodeId!: string;
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(20000) headerHtml?: string;
  @IsOptional() @IsString() @MaxLength(20000) footerHtml?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
export class FormatDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(64) documentType!: string;
  @IsString() @MaxLength(100000) template!: string;
  @IsOptional() @IsString() @MaxLength(20000) css?: string;
  @IsOptional() @IsUUID() letterheadId?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() allowDraft?: boolean;
  @IsOptional() @IsBoolean() allowCancelled?: boolean;
}
export class RenderDto {
  @IsString() documentType!: string;
  @IsOptional() @IsUUID() documentId?: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
  @IsOptional() @IsUUID() formatId?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID() letterheadId?: string | null;
}

export class PrinterDto { @IsString() @MaxLength(100) name!: string; @IsString() @MaxLength(255) host!: string; @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number; }
export class BulkDto {
  @IsString() documentType!: string;
  @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) documentIds!: string[];
  @IsOptional() @IsUUID() formatId?: string;
  @IsOptional() @IsUUID() printerId?: string;
}

type Svc = PrintingService;
type Jobs = PrintJobService;

@Controller({ path: 'printing', version: '1' })
@UseFilters(PrintingExceptionFilter)
export class PrintingController {
  constructor(private readonly service: PrintingService, private readonly jobs: PrintJobService) {}

  @Get('letterheads')
  async letterheads(@Query('orgNodeId') orgNodeId?: string): Promise<{ letterheads: Awaited<ReturnType<Svc['listLetterheads']>> }> { return { letterheads: await this.service.listLetterheads(orgNodeId || undefined) }; }

  @Post('letterheads') @HttpCode(201)
  async letterhead(@Body() dto: LetterheadDto): Promise<{ letterhead: Awaited<ReturnType<Svc['createLetterhead']>> }> { return { letterhead: await this.service.createLetterhead(dto) }; }

  @Get('formats')
  async formats(@Query('documentType') documentType?: string): Promise<{ formats: Awaited<ReturnType<Svc['listFormats']>> }> { return { formats: await this.service.listFormats(documentType || undefined) }; }

  @Post('formats') @HttpCode(201)
  async format(@Body() dto: FormatDto): Promise<{ format: Awaited<ReturnType<Svc['createFormat']>> }> { return { format: await this.service.createFormat(dto) }; }

  /** Returns the printable HTML page. */
  @Post('render') @HttpCode(200) @Header('Content-Type', 'text/html; charset=utf-8')
  async render(@Body() dto: RenderDto): Promise<string> { return this.service.render(dto); }

  @Get('printers')
  async printers(): Promise<{ printers: Awaited<ReturnType<Jobs['printers']>> }> { return { printers: await this.jobs.printers() }; }

  @Post('printers') @HttpCode(201)
  async printer(@Body() dto: PrinterDto): Promise<{ printer: Awaited<ReturnType<Jobs['addPrinter']>> }> { return { printer: await this.jobs.addPrinter(dto) }; }

  /** Bulk printing in the background: returns the job at once (202). */
  @Post('jobs') @HttpCode(202)
  async queue(@Body() dto: BulkDto): Promise<{ job: Awaited<ReturnType<Jobs['queue']>> }> { return { job: await this.jobs.queue(dto) }; }

  @Get('jobs')
  async list(): Promise<{ jobs: Awaited<ReturnType<Jobs['list']>> }> { return { jobs: await this.jobs.list() }; }

  @Get('jobs/:id')
  async job(@Param('id', ParseUUIDPipe) id: string): Promise<{ job: Awaited<ReturnType<Jobs['get']>> }> { return { job: await this.jobs.get(id) }; }

  @Get('jobs/:id/output') @Header('Content-Type', 'text/html; charset=utf-8')
  async output(@Param('id', ParseUUIDPipe) id: string): Promise<string> { return this.jobs.output(id); }
}
