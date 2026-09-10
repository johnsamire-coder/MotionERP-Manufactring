import { Module } from '@nestjs/common';
import { QualityController } from './quality.controller';
import { QualityRepository } from './quality.repository';
import { QualityService } from './quality.service';

@Module({
  controllers: [QualityController],
  providers: [QualityService, QualityRepository],
  exports: [QualityService],
})
export class QualityModule {}
