import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { CatalogNotFoundError, CatalogValidationError } from './catalog.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(CatalogNotFoundError, CatalogValidationError)
export class CatalogExceptionFilter implements ExceptionFilter {
  catch(exception: CatalogNotFoundError | CatalogValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof CatalogNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
