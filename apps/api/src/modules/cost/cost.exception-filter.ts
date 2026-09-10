import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { CostNotFoundError, CostValidationError } from './cost.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(CostNotFoundError, CostValidationError)
export class CostExceptionFilter implements ExceptionFilter {
  catch(exception: CostNotFoundError | CostValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof CostNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
