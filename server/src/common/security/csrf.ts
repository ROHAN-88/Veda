import { doubleCsrf, type DoubleCsrfUtilities } from 'csrf-csrf';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { csrfCookieName, sessionCookieName } from '../../config/security.config';

/**
 * Builds the csrf-csrf double-submit utilities.
 *
 * - The token is bound to the session via `getSessionIdentifier` (sha256 of the
 *   session cookie), so a token minted for one session can't be replayed under
 *   another.
 * - The CSRF cookie is intentionally NOT HttpOnly: the SPA reads it and echoes
 *   the value in the `X-CSRF-Token` header (the "double submit"). The session
 *   cookie stays HttpOnly.
 * - `secure`/`__Host-` are gated on prod (browsers drop Secure cookies over dev http).
 */
export function createCsrf(secret: string, isProd: boolean): DoubleCsrfUtilities {
  const sessionCookie = sessionCookieName(isProd);
  return doubleCsrf({
    getSecret: () => secret,
    getSessionIdentifier: (req: Request): string => {
      const token = (req.cookies as Record<string, string> | undefined)?.[sessionCookie];
      return token ? createHash('sha256').update(token).digest('hex') : 'anonymous';
    },
    cookieName: csrfCookieName(isProd),
    cookieOptions: {
      httpOnly: false,
      secure: isProd,
      sameSite: 'strict',
      path: '/',
    },
    size: 32,
    getCsrfTokenFromRequest: (req: Request): string | undefined => {
      const header = req.headers['x-csrf-token'];
      return Array.isArray(header) ? header[0] : header;
    },
  });
}
