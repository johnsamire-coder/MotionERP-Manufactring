import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthTokenService } from './auth-token.service';
import { AuthenticationGuard } from './guards/authentication.guard';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  controllers: [AuthController, RbacController],
  providers: [
    AuthService, AuthRepository, RbacService, AuthTokenService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
  exports: [AuthService, AuthTokenService],
})
export class AuthModule {}
