import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectTransferController } from './transfer.controller';
import { ProjectTransferService } from './transfer.service';

@Module({
  imports: [AuthModule], // provides the exported SessionAuthGuard
  controllers: [ProjectsController, ProjectTransferController],
  providers: [ProjectsService, ProjectTransferService],
})
export class ProjectsModule {}
