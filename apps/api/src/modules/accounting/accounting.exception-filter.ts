import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { AccountingNotFoundError, AccountingValidationError } from './accounting.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(AccountingNotFoundError, AccountingValidationError)
export class AccountingExceptionFilter implements ExceptionFilter {
  catch(exception: AccountingNotFoundError | AccountingValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof AccountingNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
