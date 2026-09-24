import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { WorkflowForbiddenError, WorkflowNotFoundError, WorkflowValidationError } from './workflow.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(WorkflowNotFoundError, WorkflowValidationError, WorkflowForbiddenError)
export class WorkflowExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const status = exception instanceof WorkflowNotFoundError ? 404 : exception instanceof WorkflowForbiddenError ? 403 : 400;
    host.switchToHttp().getResponse<HttpResponse>().status(status).json({ statusCode: status, message: exception.message });
  }
}
