import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { CookieOptions } from 'express';
import type { HelmetOptions } from 'helmet';

/** Session cookie name. The `__Host-` prefix (prod) requires Secure + Path=/ + no Domain. */
export const SESSION_COOKIE_PROD = '__Host-sb.sid';
export const SESSION_COOKIE_DEV = 'sb.sid';

/** CSRF cookie name (double-submit). Readable by JS so the SPA can echo the token. */
export const CSRF_COOKIE_PROD = '__Host-sb.csrf';
export const CSRF_COOKIE_DEV = 'sb.csrf';

export function isProduction(nodeEnv: string): boolean {
  return nodeEnv === 'production';
}

export function sessionCookieName(isProd: boolean): string {
  return isProd ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV;
}

export function csrfCookieName(isProd: boolean): string {
  return isProd ? CSRF_COOKIE_PROD : CSRF_COOKIE_DEV;
}

export function parseCorsOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * CORS with credentials: the origin MUST be an explicit allowlist (never `*`),
 * and `X-CSRF-Token` must be an allowed request header for the double-submit flow.
 */
export function buildCorsOptions(rawOrigins: string): CorsOptions {
  return {
    origin: parseCorsOrigins(rawOrigins),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  };
}

/**
 * Session cookie flags. `Secure` and the `__Host-` prefix are gated on prod
 * because browsers drop Secure cookies over plain http in local dev.
 */
export function buildSessionCookieOptions(isProd: boolean, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  };
}

/** Helmet baseline for a JSON API (no HTML/JS is served from this origin). */
export const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
};
