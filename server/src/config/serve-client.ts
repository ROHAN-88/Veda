import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

/**
 * Single-image deploy: the NestJS process also serves the built SPA from the same
 * origin (required by the `SameSite=Strict` cookie design). Opt-in via the
 * `CLIENT_DIST` env var — set only inside the Docker image — so tests and API-only
 * dev are unaffected.
 */

/** The built SPA directory to serve, or `null` when API-only (tests / dev). */
export function clientDistDir(): string | null {
  const dir = process.env.CLIENT_DIST;
  return dir && existsSync(dir) ? dir : null;
}

/** Serve real files under `dir` directly (`/assets/*.js|css`, etc.). */
export function attachClientStatic(app: NestExpressApplication, dir: string): void {
  // index:false so `/` flows to the fallback below (one code path for HTML).
  app.useStaticAssets(dir, { index: false });
}

/**
 * SPA fallback for client-side routes: any GET that accepts HTML and is not `/api…`
 * or `/health` returns `index.html`. Everything else calls `next()`, so the Nest
 * router still handles the API and non-HTML misses 404 normally.
 *
 * The shell is read ONCE at startup and the cached string is sent per request —
 * the path is a fixed build artifact (never request input), so there is no
 * `sendFile` / path-traversal sink.
 */
export function attachClientFallback(app: NestExpressApplication, dir: string): void {
  const indexHtml = readFileSync(join(dir, 'index.html'), 'utf8');
  app.use((req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' || !req.accepts('html')) {
      return next();
    }
    if (req.path === '/health' || req.path.startsWith('/api')) {
      return next();
    }
    res.type('html').send(indexHtml);
  });
}
