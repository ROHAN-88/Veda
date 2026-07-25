import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DoubleCsrfProtection } from 'csrf-csrf';
import type { Request, Response } from 'express';
import { isProduction } from '../../config/security.config';
import { createCsrf } from './csrf';

/**
 * Singleton wrapper around the csrf-csrf utilities so the same instance is
 * shared between the Express middleware (applied in `main.ts`) and the
 * controller that mints tokens (`GET /auth/csrf`).
 */
@Injectable()
export class CsrfService {
  readonly protection: DoubleCsrfProtection;
  private readonly generate: (req: Request, res: Response) => string;

  constructor(config: ConfigService) {
    const secret = config.getOrThrow<string>('SESSION_SECRET');
    const isProd = isProduction(config.getOrThrow<string>('NODE_ENV'));
    const { doubleCsrfProtection, generateCsrfToken } = createCsrf(secret, isProd);
    this.protection = doubleCsrfProtection;
    this.generate = generateCsrfToken;
  }

  issueToken(req: Request, res: Response): string {
    return this.generate(req, res);
  }
}
