import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { DeliveryNotFoundError, DeliveryValidationError } from './delivery.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(DeliveryNotFoundError, DeliveryValidationError)
export class DeliveryExceptionFilter implements ExceptionFilter {
  catch(exception: DeliveryNotFoundError | DeliveryValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof DeliveryNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
