import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthTokenService } from './auth-token.service';
import { AuthenticationGuard } from './guards/authentication.guard';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';
import { UserPermissionController } from './user-permission.controller';
import { UserPermissionService } from './user-permission.service';

@Module({
  controllers: [AuthController, RbacController, UserPermissionController],
  providers: [
    AuthService,
    AuthRepository,
    RbacService,
    AuthTokenService,
    UserPermissionService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
  exports: [AuthService, AuthTokenService, UserPermissionService],
})
export class AuthModule {}
