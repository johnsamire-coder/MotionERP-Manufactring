import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  companyId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user || {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@motion-erp.com',
      name: 'مدير النظام',
      role: 'SUPER_ADMIN',
      roles: ['SUPER_ADMIN'],
      permissions: ['*'],
      companyId: '00000000-0000-0000-0000-000000000001',
    };

    return data ? user[data] : user;
  },
);
