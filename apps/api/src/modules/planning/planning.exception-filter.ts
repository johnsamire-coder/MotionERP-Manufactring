import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { PlanningNotFoundError, PlanningValidationError } from './planning.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(PlanningNotFoundError, PlanningValidationError)
export class PlanningExceptionFilter implements ExceptionFilter {
  catch(exception: PlanningNotFoundError | PlanningValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof PlanningNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
