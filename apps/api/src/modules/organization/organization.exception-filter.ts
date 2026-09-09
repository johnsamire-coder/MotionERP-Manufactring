import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import {
  OrgCycleError,
  OrgLifecycleError,
  OrgNodeNotFoundError,
  OrgNodeValidationError,
  OrgParentingError,
} from './organization.errors';

type OrgError =
  | OrgNodeNotFoundError
  | OrgNodeValidationError
  | OrgParentingError
  | OrgCycleError
  | OrgLifecycleError;

/** Minimal shape of the platform HTTP response (avoids depending on express types). */
interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

/** Maps organization domain errors to HTTP responses (keeps the service HTTP-free). */
@Catch(
  OrgNodeNotFoundError,
  OrgNodeValidationError,
  OrgParentingError,
  OrgCycleError,
  OrgLifecycleError,
)
export class OrganizationExceptionFilter implements ExceptionFilter {
  catch(exception: OrgError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const status = this.statusFor(exception);
    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
    });
  }

  private statusFor(exception: OrgError): number {
    if (exception instanceof OrgNodeNotFoundError) return HttpStatus.NOT_FOUND;
    if (exception instanceof OrgNodeValidationError) return HttpStatus.BAD_REQUEST;
    return HttpStatus.CONFLICT;
  }
}
