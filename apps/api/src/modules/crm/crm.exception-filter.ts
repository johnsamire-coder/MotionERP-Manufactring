import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { CrmNotFoundError, CrmValidationError } from './crm.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(CrmNotFoundError, CrmValidationError)
export class CrmExceptionFilter implements ExceptionFilter {
  catch(exception: CrmNotFoundError | CrmValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof CrmNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
