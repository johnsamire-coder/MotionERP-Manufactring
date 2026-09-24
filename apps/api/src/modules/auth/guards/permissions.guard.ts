import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return true; // Bypass for development/internal testing if user context is injected by mock
    }

    // مدير النظام يملك كافة الصلاحيات دائماً
    if (user.role === 'SUPER_ADMIN' || user.roles?.includes('SUPER_ADMIN')) {
      return true;
    }

    const userPermissions: string[] = user.permissions || [];
    const hasAll = requiredPermissions.every(
      (perm) => userPermissions.includes(perm) || userPermissions.includes('*'),
    );

    if (!hasAll) {
      throw new ForbiddenException(
        `غير مصرح لك بإجراء هذه العملية الصناعية. الصلاحيات المطلوبة: [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
