import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppConfigService } from '../../core/config/app-config.service';
import { AuthTokenService } from './auth-token.service';
import type { AuthRepository } from './auth.repository';
import { AuthenticationGuard } from './guards/authentication.guard';
import type { UserRecord } from './auth.types';

describe('Authentication (plan item 5.0)', () => {
  const activeUser: UserRecord = { id: 'u-1', username: 'ahmed', roleId: 'r-1', employeeReference: null, status: 'active' };
  let users: Map<string, UserRecord>;
  let enforce: boolean;
  let tokens: AuthTokenService;
  let guard: AuthenticationGuard;

  const config = () => ({
    authJwtSecret: 'x'.repeat(40),
    authTokenTtlSeconds: 3600,
    get authEnforce() { return enforce; },
  }) as unknown as AppConfigService;

  const context = (headers: Record<string, string>, isPublic = false) => {
    const request: { headers: Record<string, string>; user?: unknown } = { headers };
    const handler = () => undefined;
    if (isPublic) Reflect.defineMetadata('isPublic', true, handler);
    const ctx = {
      getType: () => 'http',
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { ctx, request };
  };

  beforeEach(() => {
    enforce = false;
    users = new Map([[activeUser.id, { ...activeUser }]]);
    const repo = {
      findUserById: jest.fn().mockImplementation(async (id: string) => users.get(id) ?? null),
      findRoleById: jest.fn().mockResolvedValue({ id: 'r-1', code: 'STORE_KEEPER', name: 'Store keeper', status: 'active' }),
    } as unknown as AuthRepository;
    const cfg = config();
    tokens = new AuthTokenService(cfg, repo);
    guard = new AuthenticationGuard(new Reflector(), tokens, cfg);
  });

  it('1. a valid token sets request.user with the role code', async () => {
    const token = await tokens.issue(activeUser);
    const { ctx, request } = context({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'u-1', name: 'ahmed', role: 'STORE_KEEPER', roles: ['STORE_KEEPER'] });
  });

  it('2. no token passes while AUTH_ENFORCE is off (current behaviour) and is rejected once it is on', async () => {
    await expect(guard.canActivate(context({}).ctx)).resolves.toBe(true);
    enforce = true;
    await expect(guard.canActivate(context({}).ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('3. public routes pass without a token even when enforced', async () => {
    enforce = true;
    await expect(guard.canActivate(context({}, true).ctx)).resolves.toBe(true);
  });

  it('4. a bad token is rejected, except on public routes (so a stale token cannot block login)', async () => {
    const bad = { authorization: 'Bearer not-a-real-token' };
    await expect(guard.canActivate(context(bad).ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context(bad, true).ctx)).resolves.toBe(true);
  });

  it('5. a deactivated user is locked out immediately, even with an unexpired token', async () => {
    const token = await tokens.issue(activeUser);
    users.get('u-1')!.status = 'inactive';
    await expect(guard.canActivate(context({ authorization: `Bearer ${token}` }).ctx)).rejects.toThrow(/غير نشط/);
  });

  it('6. a token signed with another secret is rejected', async () => {
    const otherRepo = { findUserById: jest.fn(), findRoleById: jest.fn() } as unknown as AuthRepository;
    const other = new AuthTokenService({ ...config(), authJwtSecret: 'y'.repeat(40) } as unknown as AppConfigService, otherRepo);
    const forged = await other.issue(activeUser);
    await expect(guard.canActivate(context({ authorization: `Bearer ${forged}` }).ctx)).rejects.toThrow(UnauthorizedException);
  });
});
