import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule], // provides the exported SessionAuthGuard (upload route)
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
