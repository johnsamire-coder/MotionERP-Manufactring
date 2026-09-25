import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseFilters,
} from '@nestjs/common';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { PercentMethod } from './progress';
import {
  ProjectsNotFoundError,
  ProjectsService,
  ProjectsValidationError,
} from './projects.service';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}
@Catch(ProjectsNotFoundError, ProjectsValidationError)
export class ProjectsExceptionFilter implements ExceptionFilter {
  catch(e: Error, host: ArgumentsHost): void {
    const status = e instanceof ProjectsNotFoundError ? 404 : 400;
    host
      .switchToHttp()
      .getResponse<HttpResponse>()
      .status(status)
      .json({ statusCode: status, message: e.message });
  }
}

const METHODS = ['manual', 'task_completion', 'task_progress', 'task_weight'];
const FREQ = ['none', 'daily', 'weekly', 'monthly'];
export class CreateProjectDto {
  @IsString() @MaxLength(64) code!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsUUID() orgNodeId!: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsIn(METHODS) percentCompleteMethod?: PercentMethod;
  @IsOptional() @IsNumberString() estimatedCost?: string;
  @IsOptional() @IsNumberString() contractValue?: string;
  @IsOptional() @IsIn(FREQ) reportFrequency?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) reportRecipients?: string[];
}
export class UpdateProjectDto {
  @IsOptional() @IsIn(['open', 'completed', 'cancelled']) status?: string;
  @IsOptional() @IsIn(METHODS) percentCompleteMethod?: PercentMethod;
  @IsOptional() @IsNumber() @Min(0) @Max(100) manualPercentComplete?: number;
  @IsOptional() @IsIn(FREQ) reportFrequency?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) reportRecipients?: string[];
}
export class TaskDto {
  @IsString() @MaxLength(300) subject!: string;
  @IsOptional() @IsNumber() @Min(0) weight?: number;
  @IsOptional() @IsDateString() expectedEnd?: string;
}
export class UpdateTaskDto {
  @IsOptional() @IsIn(['open', 'working', 'completed', 'cancelled']) status?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsNumber() @Min(0) weight?: number;
}

type Svc = ProjectsService;

@Controller({ path: 'projects', version: '1' })
@UseFilters(ProjectsExceptionFilter)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  async list(): Promise<{ projects: Awaited<ReturnType<Svc['list']>> }> {
    return { projects: await this.service.list() };
  }

  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateProjectDto,
  ): Promise<{ project: Awaited<ReturnType<Svc['create']>> }> {
    return { project: await this.service.create(dto) };
  }

  @Get('outbox')
  async outbox(): Promise<{ emails: Awaited<ReturnType<Svc['outbox']>> }> {
    return { emails: await this.service.outbox() };
  }

  @Post('outbox/:id/send')
  @HttpCode(200)
  async resend(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ email: Awaited<ReturnType<Svc['deliver']>> }> {
    return { email: await this.service.deliver(id) };
  }

  @Post('reports/send-due')
  @HttpCode(200)
  async due(): Promise<{ sent: string[] }> {
    return { sent: await this.service.sendDueReports() };
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ project: Awaited<ReturnType<Svc['get']>> }> {
    return { project: await this.service.get(id) };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<{ project: Awaited<ReturnType<Svc['update']>> }> {
    return { project: await this.service.update(id, dto) };
  }

  @Post(':id/tasks')
  @HttpCode(201)
  async addTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TaskDto,
  ): Promise<{ task: Awaited<ReturnType<Svc['addTask']>> }> {
    return { task: await this.service.addTask(id, dto) };
  }

  @Patch('tasks/:taskId')
  async updateTask(
    @Param('taskId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<{ task: Awaited<ReturnType<Svc['updateTask']>> }> {
    return { task: await this.service.updateTask(id, dto) };
  }

  @Post(':id/status-report')
  @HttpCode(200)
  async report(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ email: Awaited<ReturnType<Svc['statusReport']>> }> {
    return { email: await this.service.statusReport(id) };
  }
}
