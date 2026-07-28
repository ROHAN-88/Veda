import { Controller, Get, Param } from '@nestjs/common';
import { minutes, Throttle } from '@nestjs/throttler';
import { ShareService } from './share.service';

/**
 * The ONE public, unauthenticated route in the app. It deliberately carries no
 * `SessionAuthGuard` — access is gated solely by possession of an unguessable
 * 256-bit token. A tighter throttle than the global default resists token
 * enumeration (CWE-307); an unknown/revoked token returns 404 (no existence
 * leak). CSRF does not apply (the double-submit middleware ignores GET). The
 * response carries only the shared board — no owner, user, or other-project data.
 */
@Controller('share')
export class PublicShareController {
  constructor(private readonly share: ShareService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: minutes(1) } })
  read(@Param('token') token: string) {
    return this.share.readByToken(token);
  }
}
