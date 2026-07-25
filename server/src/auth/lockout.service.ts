import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LOCKOUT_BASE_MS, LOCKOUT_MAX_MS, LOCKOUT_THRESHOLD } from './auth.constants';

/**
 * Per-account brute-force defense. Complements the per-IP throttler: this stops
 * a distributed credential-stuffing attack that spreads across many IPs but
 * targets one account.
 */
@Injectable()
export class LockoutService {
  constructor(private readonly prisma: PrismaService) {}

  isLocked(user: { lockedUntil: Date | null }): boolean {
    return user.lockedUntil !== null && user.lockedUntil > new Date();
  }

  async recordFailure(userId: string, currentFailedCount: number): Promise<void> {
    const nextCount = currentFailedCount + 1;
    let lockedUntil: Date | null = null;
    if (nextCount >= LOCKOUT_THRESHOLD) {
      const overThreshold = nextCount - LOCKOUT_THRESHOLD;
      const backoffMs = Math.min(LOCKOUT_BASE_MS * 2 ** overThreshold, LOCKOUT_MAX_MS);
      lockedUntil = new Date(Date.now() + backoffMs);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: nextCount, lockedUntil },
    });
  }

  async reset(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  }
}
