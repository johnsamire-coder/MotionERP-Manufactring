import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { FinanceNotFoundError, FinanceValidationError } from './finance.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(FinanceNotFoundError, FinanceValidationError)
export class FinanceExceptionFilter implements ExceptionFilter {
  catch(exception: FinanceNotFoundError | FinanceValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof FinanceNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
