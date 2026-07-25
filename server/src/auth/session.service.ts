import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { RequestMeta } from '../common/request-meta';
import { type SafeUser, toSafeUser } from '../common/types/authenticated-request';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_ABSOLUTE_TTL_MS, SESSION_SLIDING_TTL_MS } from './auth.constants';

export interface ValidatedSession {
  tokenHash: string;
  user: SafeUser;
}

interface SessionWindow {
  revokedAt: Date | null;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

/**
 * Server-side session store. The raw token exists only in the client cookie;
 * the DB persists sha256(rawToken) for an O(1) indexed lookup. A fast hash is
 * correct here (the token is already 256-bit CSPRNG entropy — no KDF needed —
 * and per-row salts would break the indexed equality lookup).
 */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private isActive(session: SessionWindow): boolean {
    const now = new Date();
    return session.revokedAt === null && session.expiresAt > now && session.absoluteExpiresAt > now;
  }

  /** Creates a fresh session (called on login — never reuses a pre-auth token). */
  async create(userId: string, meta: RequestMeta): Promise<string> {
    const raw = this.generateToken();
    const now = Date.now();
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(now + SESSION_SLIDING_TTL_MS),
        absoluteExpiresAt: new Date(now + SESSION_ABSOLUTE_TTL_MS),
        lastUsedAt: new Date(now),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    return raw;
  }

  async validate(raw: string): Promise<ValidatedSession | null> {
    const tokenHash = this.hashToken(raw);
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!session || !this.isActive(session)) {
      return null;
    }
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
    return { tokenHash, user: toSafeUser(session.user) };
  }

  /** Rotates the token and extends the sliding expiry, bounded by the absolute cap. */
  async rotate(oldRaw: string, meta: RequestMeta): Promise<string | null> {
    const oldHash = this.hashToken(oldRaw);
    const session = await this.prisma.session.findUnique({ where: { tokenHash: oldHash } });
    if (!session || !this.isActive(session)) {
      return null;
    }
    const raw = this.generateToken();
    const slidingTo = Date.now() + SESSION_SLIDING_TTL_MS;
    const expiresAt = new Date(Math.min(slidingTo, session.absoluteExpiresAt.getTime()));
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: this.hashToken(raw),
        expiresAt,
        lastUsedAt: new Date(),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    return raw;
  }

  async revoke(raw: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
