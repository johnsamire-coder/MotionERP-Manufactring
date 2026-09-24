import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { CrmModule } from '../crm/crm.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

/** Project management (plan item 44). */
@Module({
  imports: [AccountingModule, CrmModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
