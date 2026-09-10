import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrganizationModule } from './modules/organization/organization.module';

/**
 * Root module.
 *
 * `CoreModule` = cross-cutting platform infrastructure.
 * `src/modules/*` = business/domain modules, each independent, talking to each
 * other only through published surfaces and events (D1 / D2 / D20).
 */
@Module({
  imports: [CoreModule, OrganizationModule, CatalogModule],
})
export class AppModule {}
