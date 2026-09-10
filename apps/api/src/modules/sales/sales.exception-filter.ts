import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { SalesNotFoundError, SalesValidationError } from './sales.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(SalesNotFoundError, SalesValidationError)
export class SalesExceptionFilter implements ExceptionFilter {
  catch(exception: SalesNotFoundError | SalesValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof SalesNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
