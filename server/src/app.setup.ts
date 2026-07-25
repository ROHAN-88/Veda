import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { CsrfService } from './common/security/csrf.service';
import { buildCorsOptions, helmetOptions } from './config/security.config';

/**
 * Applies the shared security middleware chain. Used by both `main.ts` and the
 * e2e tests so the test app is wired exactly like production:
 * trust-proxy -> helmet -> cookie-parser -> CORS(allowlist,credentials)
 * -> global allowlist validation -> CSRF double-submit -> shutdown hooks.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService);
  // Namespace the API under /api (health stays at /health for uptime probes) so
  // the SPA and API are same-origin behind one reverse proxy in prod and the
  // Vite dev proxy in dev — required for SameSite=Strict cookies.
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.set('trust proxy', 1);
  app.use(helmet(helmetOptions));
  app.use(cookieParser(config.getOrThrow<string>('SESSION_SECRET')));
  app.enableCors(buildCorsOptions(config.getOrThrow<string>('CORS_ORIGINS')));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.use(app.get(CsrfService).protection);
  app.enableShutdownHooks();
}
