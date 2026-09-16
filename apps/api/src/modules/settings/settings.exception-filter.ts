import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { SettingsNotFoundError, SettingsValidationError } from './settings.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(SettingsNotFoundError, SettingsValidationError)
export class SettingsExceptionFilter implements ExceptionFilter {
  catch(exception: SettingsNotFoundError | SettingsValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof SettingsNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
