import { Module } from '@nestjs/common';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LockoutService } from './lockout.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService, LockoutService, SessionAuthGuard],
  // Exported so future feature modules (projects, cards) can reuse the guard.
  exports: [SessionService, SessionAuthGuard],
})
export class AuthModule {}
