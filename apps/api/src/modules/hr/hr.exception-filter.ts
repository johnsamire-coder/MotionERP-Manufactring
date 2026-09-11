import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { HrNotFoundError, HrValidationError } from './hr.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(HrNotFoundError, HrValidationError)
export class HrExceptionFilter implements ExceptionFilter {
  catch(exception: HrNotFoundError | HrValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof HrNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
