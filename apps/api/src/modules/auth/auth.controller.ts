import { Body, Controller, Get, HttpCode, Post, Query, UseFilters } from '@nestjs/common';
import { CheckPermissionDto, CreatePermissionDto, CreateRoleDto, CreateUserDto, LoginDto } from './auth.dto';
import { AuthExceptionFilter } from './auth.exception-filter';
import { AuthService } from './auth.service';
import type { PermissionRecord, RoleRecord, UserRecord } from './auth.types';

@Controller({ path: 'auth', version: '1' })
@UseFilters(AuthExceptionFilter)
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get('roles')
  async roles(): Promise<{ roles: RoleRecord[] }> { return { roles: await this.service.getRoles() }; }

  @Post('roles') @HttpCode(201)
  async createRole(@Body() dto: CreateRoleDto): Promise<{ role: RoleRecord }> { return { role: await this.service.createRole(dto) }; }

  @Get('permissions')
  async permissions(@Query('roleId') roleId?: string): Promise<{ permissions: PermissionRecord[] }> {
    return { permissions: await this.service.getPermissions(roleId) };
  }

  @Post('permissions') @HttpCode(201)
  async grantPermission(@Body() dto: CreatePermissionDto): Promise<{ permission: PermissionRecord }> {
    return { permission: await this.service.grantPermission(dto) };
  }

  @Get('users')
  async users(): Promise<{ users: UserRecord[] }> { return { users: await this.service.getUsers() }; }

  @Post('users') @HttpCode(201)
  async createUser(@Body() dto: CreateUserDto): Promise<{ user: UserRecord }> { return { user: await this.service.createUser(dto) }; }

  @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto): Promise<{ user: UserRecord }> { return { user: await this.service.login(dto.username, dto.password) }; }

  @Post('check-permission') @HttpCode(200)
  async checkPermission(@Body() dto: CheckPermissionDto): Promise<{ allowed: boolean }> {
    const allowed = await this.service.checkPermission(dto.userId, dto.action, dto.resource, dto.scopeOrgNodeId, dto.value);
    return { allowed };
  }
}
