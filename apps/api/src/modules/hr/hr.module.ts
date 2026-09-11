import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { HrRepository } from './hr.repository';
import { HrService } from './hr.service';

@Module({
  controllers: [HrController],
  providers: [HrService, HrRepository],
  exports: [HrService],
})
export class HrModule {}
