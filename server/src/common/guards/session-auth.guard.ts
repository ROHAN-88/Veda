import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isProduction, sessionCookieName } from '../../config/security.config';
import { SessionService } from '../../auth/session.service';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Deny-by-default session guard. Reads the session cookie, validates it against
 * the store, and attaches the authenticated user to the request. Any failure —
 * missing/invalid/revoked/expired session — results in 401.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly isProd: boolean;

  constructor(
    private readonly sessions: SessionService,
    config: ConfigService,
  ) {
    this.isProd = isProduction(config.getOrThrow<string>('NODE_ENV'));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieName = sessionCookieName(this.isProd);
    const raw = (req.cookies as Record<string, string> | undefined)?.[cookieName];
    if (!raw) {
      throw new UnauthorizedException();
    }

    const result = await this.sessions.validate(raw);
    if (!result) {
      throw new UnauthorizedException();
    }

    req.user = result.user;
    req.sessionTokenHash = result.tokenHash;
    return true;
  }
}
