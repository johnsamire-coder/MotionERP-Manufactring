import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { QualityNotFoundError, QualityValidationError } from './quality.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(QualityNotFoundError, QualityValidationError)
export class QualityExceptionFilter implements ExceptionFilter {
  catch(exception: QualityNotFoundError | QualityValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof QualityNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
