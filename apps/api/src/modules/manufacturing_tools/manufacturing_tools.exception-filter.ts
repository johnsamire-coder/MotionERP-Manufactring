import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ManufacturingToolsNotFoundError, ManufacturingToolsValidationError } from './manufacturing_tools.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(ManufacturingToolsNotFoundError, ManufacturingToolsValidationError)
export class ManufacturingToolsExceptionFilter implements ExceptionFilter {
  catch(exception: ManufacturingToolsNotFoundError | ManufacturingToolsValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof ManufacturingToolsNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
