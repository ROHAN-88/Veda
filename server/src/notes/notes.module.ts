import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [AuthModule], // provides the exported SessionAuthGuard
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
