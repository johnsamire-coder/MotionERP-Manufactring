import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { InventoryNotFoundError, InventoryValidationError } from '../inventory/inventory.errors';
import { ProductionNotFoundError, ProductionValidationError } from './production.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(ProductionNotFoundError, ProductionValidationError, InventoryNotFoundError, InventoryValidationError)
export class ProductionExceptionFilter implements ExceptionFilter {
  catch(
    exception: ProductionNotFoundError | ProductionValidationError | InventoryNotFoundError | InventoryValidationError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const isNotFound = exception instanceof ProductionNotFoundError || exception instanceof InventoryNotFoundError;
    response.status(isNotFound ? 404 : 400).json({ statusCode: isNotFound ? 404 : 400, message: exception.message });
  }
}
