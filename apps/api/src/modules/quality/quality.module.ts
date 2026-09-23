import { Module } from '@nestjs/common';
import { ProductionModule } from '../production/production.module';
import { ProductionOpsModule } from '../production_ops/production_ops.module';
import { QualityController } from './quality.controller';
import { QualityRepository } from './quality.repository';
import { QualityService } from './quality.service';
import { CatalogModule } from '../catalog/catalog.module';
import { QualityReadingsController } from './quality-readings.controller';
import { QualityReadingsRepository } from './quality-readings.repository';
import { QualityReadingsService } from './quality-readings.service';

@Module({
  imports: [ProductionModule, ProductionOpsModule, CatalogModule],
  controllers: [QualityController, QualityReadingsController],
  providers: [QualityService, QualityRepository, QualityReadingsService, QualityReadingsRepository],
  exports: [QualityService],
})
export class QualityModule {}
