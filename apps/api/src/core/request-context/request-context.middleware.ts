import { Injectable, type NestMiddleware } from '@nestjs/common';
import { requestContext } from './request-context';

/** Opens a fresh request context around every HTTP request (plan item 5.2). */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(_req: unknown, _res: unknown, next: () => void): void {
    requestContext.run({}, next);
  }
}
