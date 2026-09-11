import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { AuthNotFoundError, AuthValidationError } from './auth.errors';

interface HttpResponse { status(code: number): HttpResponse; json(body: unknown): void; }

@Catch(AuthNotFoundError, AuthValidationError)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: AuthNotFoundError | AuthValidationError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const status = exception instanceof AuthNotFoundError ? 404 : 400;
    response.status(status).json({ statusCode: status, message: exception.message });
  }
}
