import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { CsrfService } from './common/security/csrf.service';
import { buildCorsOptions, buildHelmetOptions } from './config/security.config';
import { attachClientFallback, attachClientStatic, clientDistDir } from './config/serve-client';

/**
 * Applies the shared security middleware chain. Used by both `main.ts` and the
 * e2e tests so the test app is wired exactly like production:
 * trust-proxy -> helmet -> cookie-parser -> CORS(allowlist,credentials)
 * -> [static SPA] -> global allowlist validation -> CSRF double-submit
 * -> [SPA fallback] -> shutdown hooks.
 *
 * When `CLIENT_DIST` points at a built SPA (the single Docker image), this same
 * process serves the client from this origin; otherwise it's an API-only app.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  const clientDist = clientDistDir(); // null unless CLIENT_DIST is set + exists
  // Namespace the API under /api (health stays at /health for uptime probes) so
  // the SPA and API are same-origin behind one reverse proxy in prod and the
  // Vite dev proxy in dev — required for SameSite=Strict cookies.
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.set('trust proxy', 1);
  app.use(helmet(buildHelmetOptions(clientDist !== null)));
  app.use(cookieParser(config.getOrThrow<string>('SESSION_SECRET')));
  app.enableCors(buildCorsOptions(config.getOrThrow<string>('CORS_ORIGINS')));
  if (clientDist) {
    attachClientStatic(app, clientDist);
  }
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.use(app.get(CsrfService).protection);
  if (clientDist) {
    attachClientFallback(app, clientDist);
  }
  app.enableShutdownHooks();
}
