import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { CreateUserPermissionDto } from './auth.dto';
import { AuthExceptionFilter } from './auth.exception-filter';
import type { UserPermissionRecord } from './auth.types';
import { UserPermissionService } from './user-permission.service';

@Controller({ path: 'auth/user-permissions', version: '1' })
@UseFilters(AuthExceptionFilter)
export class UserPermissionController {
  constructor(private readonly service: UserPermissionService) {}

  @Get()
  async list(
    @Query('userId') userId?: string,
  ): Promise<{ userPermissions: UserPermissionRecord[] }> {
    return { userPermissions: await this.service.list(userId) };
  }

  @Post()
  @HttpCode(201)
  async add(
    @Body() dto: CreateUserPermissionDto,
  ): Promise<{ userPermission: UserPermissionRecord }> {
    return { userPermission: await this.service.add(dto) };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.remove(id);
  }
}
