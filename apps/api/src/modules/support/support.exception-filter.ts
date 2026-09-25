import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { SupportNotFoundError, SupportValidationError } from './support.errors';

interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

@Catch(SupportNotFoundError, SupportValidationError)
export class SupportExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const status = exception instanceof SupportNotFoundError ? 404 : 400;
    host
      .switchToHttp()
      .getResponse<HttpResponse>()
      .status(status)
      .json({ statusCode: status, message: exception.message });
  }
}
