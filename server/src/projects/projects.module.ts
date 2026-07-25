import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuthModule], // provides the exported SessionAuthGuard
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
