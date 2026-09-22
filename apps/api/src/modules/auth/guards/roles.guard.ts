import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return true;
    }

    if (user.role === 'SUPER_ADMIN' || user.roles?.includes('SUPER_ADMIN')) {
      return true;
    }

    const userRoles: string[] = Array.isArray(user.roles)
      ? user.roles
      : [user.role].filter(Boolean);

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `الدور الوظيفي الخاص بك غير مصرح له بالوصول. الأدوار المطلوبة: [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}