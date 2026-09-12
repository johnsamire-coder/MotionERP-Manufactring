import { Module } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { ProductionOpsModule } from '../production_ops/production_ops.module';
import { QualityController } from './quality.controller';
import { QualityRepository } from './quality.repository';
import { QualityService } from './quality.service';

@Module({
  imports: [ProductionModule, ProductionOpsModule],
  controllers: [QualityController],
  providers: [QualityService, QualityRepository],
  exports: [QualityService],
})
export class QualityModule {}
