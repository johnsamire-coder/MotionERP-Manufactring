import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { TechnicalNotFoundError, TechnicalValidationError } from './technical.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(TechnicalNotFoundError, TechnicalValidationError)
export class TechnicalExceptionFilter implements ExceptionFilter {
  catch(exception: TechnicalNotFoundError | TechnicalValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof TechnicalNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
