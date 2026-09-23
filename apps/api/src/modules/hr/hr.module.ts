import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HrController } from './hr.controller';
import { HrRepository } from './hr.repository';
import { HrService } from './hr.service';

@Module({
  imports: [AuthModule],
  controllers: [HrController],
  providers: [HrService, HrRepository],
  exports: [HrService],
})
export class HrModule {}
