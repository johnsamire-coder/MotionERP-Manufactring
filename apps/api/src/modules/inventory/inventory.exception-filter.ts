import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { InventoryNotFoundError, InventoryValidationError } from './inventory.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(InventoryNotFoundError, InventoryValidationError)
export class InventoryExceptionFilter implements ExceptionFilter {
  catch(exception: InventoryNotFoundError | InventoryValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof InventoryNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
