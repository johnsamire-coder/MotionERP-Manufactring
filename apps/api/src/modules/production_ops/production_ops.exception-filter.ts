import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ProductionOpsNotFoundError, ProductionOpsValidationError } from './production_ops.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(ProductionOpsNotFoundError, ProductionOpsValidationError)
export class ProductionOpsExceptionFilter implements ExceptionFilter {
  catch(exception: ProductionOpsNotFoundError | ProductionOpsValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof ProductionOpsNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
