import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import {
  CheckPermissionDto,
  CreatePermissionDto,
  CreateRoleDto,
  CreateUserDto,
  LoginDto,
} from './auth.dto';
import { AuthExceptionFilter } from './auth.exception-filter';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import type { CurrentUserPayload } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import type { PermissionRecord, RoleRecord, UserRecord } from './auth.types';

@Controller({ path: 'auth', version: '1' })
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly tokens: AuthTokenService,
  ) {}

  @Get('roles')
  async roles(): Promise<{ roles: RoleRecord[] }> {
    return { roles: await this.service.getRoles() };
  }

  @Post('roles')
  @HttpCode(201)
  async createRole(@Body() dto: CreateRoleDto): Promise<{ role: RoleRecord }> {
    return { role: await this.service.createRole(dto) };
  }

  @Get('permissions')
  async permissions(
    @Query('roleId') roleId?: string,
  ): Promise<{ permissions: PermissionRecord[] }> {
    return { permissions: await this.service.getPermissions(roleId) };
  }

  @Post('permissions')
  @HttpCode(201)
  async grantPermission(
    @Body() dto: CreatePermissionDto,
  ): Promise<{ permission: PermissionRecord }> {
    return { permission: await this.service.grantPermission(dto) };
  }

  @Get('users')
  async users(): Promise<{ users: UserRecord[] }> {
    return { users: await this.service.getUsers() };
  }

  @Post('users')
  @HttpCode(201)
  async createUser(@Body() dto: CreateUserDto): Promise<{ user: UserRecord }> {
    return { user: await this.service.createUser(dto) };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ user: UserRecord; accessToken: string; expiresInSeconds: number }> {
    const user = await this.service.login(dto.username, dto.password);
    return {
      user,
      accessToken: await this.tokens.issue(user),
      expiresInSeconds: this.tokens.ttlSeconds,
    };
  }

  /** The user behind the request's login token (401 without one). */
  @Get('me')
  me(@Req() req: { user?: CurrentUserPayload }): { user: CurrentUserPayload } {
    if (!req.user) throw new UnauthorizedException('تسجيل الدخول مطلوب');
    return { user: req.user };
  }

  @Post('check-permission')
  @HttpCode(200)
  async checkPermission(@Body() dto: CheckPermissionDto): Promise<{ allowed: boolean }> {
    const allowed = await this.service.checkPermission(
      dto.userId,
      dto.action,
      dto.resource,
      dto.scopeOrgNodeId,
      dto.value,
    );
    return { allowed };
  }
}
