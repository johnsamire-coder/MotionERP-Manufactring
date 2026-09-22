import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { RbacController } from './rbac.controller';
import { RbacService } from './rbac.service';

@Module({
  controllers: [AuthController, RbacController],
  providers: [AuthService, AuthRepository, RbacService],
  exports: [AuthService],
})
export class AuthModule {}
