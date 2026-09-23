import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppConfigService } from '../../../core/config/app-config.service';
import { requestContext } from '../../../core/request-context/request-context';
import { AuthTokenService } from '../auth-token.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global guard (plan item 5.0): turns a "Bearer" login token into `request.user`.
 * - A valid token always identifies the user.
 * - A bad token is rejected (401), except on @Public() routes such as login.
 * - No token: allowed while AUTH_ENFORCE is off (today's behaviour), 401 once it is on.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AuthTokenService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown>; user?: unknown }>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]) === true;

    const header = request.headers['authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (token) {
      try {
        const user = await this.tokens.resolveUser(token);
        request.user = user;
        const store = requestContext.store();
        if (store) store.userId = user.id;
        return true;
      } catch (err) {
        if (isPublic) return true;
        throw err;
      }
    }

    if (isPublic || !this.config.authEnforce) return true;
    throw new UnauthorizedException('تسجيل الدخول مطلوب');
  }
}
