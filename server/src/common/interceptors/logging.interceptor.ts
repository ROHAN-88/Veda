import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

/**
 * Structured request logging. Logs method, path, status, and latency only —
 * never request/response bodies, headers, cookies, or query strings — so
 * secrets, passwords, and tokens are never written to logs (OWASP A09).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method;
    const path = req.originalUrl.split('?')[0];
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        this.logger.log(`${method} ${path} ${res.statusCode} ${Date.now() - start}ms`);
      }),
    );
  }
}
