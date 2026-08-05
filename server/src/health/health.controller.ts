import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

interface HealthStatus {
  status: 'ok';
  uptime: number;
  /** Commit this build came from — `dev` when built without a `GIT_SHA` arg. */
  build: string;
}

/**
 * Liveness endpoint used to confirm the API process is up.
 * Intentionally performs no I/O and exposes no user data. Exempt from rate
 * limiting so uptime probes are never throttled.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: 'ok', uptime: process.uptime(), build: process.env.BUILD_SHA || 'dev' };
  }
}
