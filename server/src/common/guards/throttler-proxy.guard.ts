import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttler that tracks the real client IP behind a trusted proxy. `req.ips` is
 * populated from X-Forwarded-For only because `trust proxy` is set for exactly
 * one hop in `main.ts` — we never trust arbitrary XFF values (which would let a
 * client spoof its IP to evade the limiter).
 */
@Injectable()
export class ThrottlerProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const ips = req.ips as string[] | undefined;
    const ip = (ips && ips.length > 0 ? ips[0] : (req.ip as string | undefined)) ?? 'unknown';
    return Promise.resolve(ip);
  }
}
