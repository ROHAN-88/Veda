import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PublicShareController } from './public-share.controller';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';

@Module({
  imports: [AuthModule], // provides the exported SessionAuthGuard (owner routes)
  controllers: [ShareController, PublicShareController],
  providers: [ShareService],
})
export class ShareModule {}
