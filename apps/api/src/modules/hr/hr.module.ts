import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationModule } from '../organization/organization.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { HrController } from './hr.controller';
import { HrRepository } from './hr.repository';
import { HrService } from './hr.service';

@Module({
  imports: [AuthModule, OrganizationModule],
  controllers: [HrController, LeaveController],
  providers: [HrService, HrRepository, LeaveService],
  exports: [HrService],
})
export class HrModule {}
