import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrintingModule } from '../printing/printing.module';
import { ProjectsModule } from '../projects/projects.module';
import { WorkflowAutomationService } from './workflow-automation.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

/** Generic workflow engine (plan item 42) — for new approvals; existing approvals are untouched. */
@Module({
  imports: [AuthModule, ProjectsModule, PrintingModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowAutomationService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
