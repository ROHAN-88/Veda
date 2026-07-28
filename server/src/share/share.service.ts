import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/** The one-time result of creating a link — the raw token is returned only here. */
export interface ShareCreateResult {
  id: string;
  token: string;
  createdAt: Date;
}

/** Owner-facing status of a project's sharing (never carries the raw token). */
export interface ShareStatus {
  active: boolean;
  createdAt: Date | null;
}

/**
 * Read-only public share links (Phase 9), live + revocable.
 *
 * Owner operations are scoped to the caller's project (404, never 403). A link's
 * raw token — 256-bit CSPRNG entropy — is returned exactly once on creation and
 * NEVER stored: the DB holds only `sha256(token)` for an O(1) indexed lookup, the
 * same convention as {@link SessionService}. Revocation sets `revokedAt` rather
 * than deleting the row. The public read reflects the project's CURRENT board
 * (no snapshot); an unknown OR revoked token both resolve to 404 so a link's
 * existence can't be probed.
 */
@Injectable()
export class ShareService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /** 404 unless `projectId` exists AND belongs to the caller. Guards owner ops. */
  private async assertProjectOwned(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  /** Revoke any existing active link, then mint a new one (one active link/project). */
  async create(userId: string, projectId: string): Promise<ShareCreateResult> {
    await this.assertProjectOwned(userId, projectId);
    const raw = this.generateToken();
    const tokenHash = this.hashToken(raw);
    const link = await this.prisma.$transaction(async (tx) => {
      await tx.shareLink.updateMany({
        where: { projectId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return tx.shareLink.create({ data: { projectId, tokenHash } });
    });
    return { id: link.id, token: raw, createdAt: link.createdAt };
  }

  async getStatus(userId: string, projectId: string): Promise<ShareStatus> {
    await this.assertProjectOwned(userId, projectId);
    const link = await this.prisma.shareLink.findFirst({
      where: { projectId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return { active: link !== null, createdAt: link?.createdAt ?? null };
  }

  async revoke(userId: string, projectId: string): Promise<void> {
    await this.assertProjectOwned(userId, projectId);
    await this.prisma.shareLink.updateMany({
      where: { projectId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Public: resolve a token to the shared board's CURRENT cards + connections. */
  async readByToken(token: string) {
    const link = await this.prisma.shareLink.findFirst({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      select: { projectId: true },
    });
    if (!link) {
      throw new NotFoundException('Share link not found');
    }
    const project = await this.prisma.project.findUnique({
      where: { id: link.projectId },
      select: { id: true, name: true },
    });
    if (!project) {
      throw new NotFoundException('Share link not found');
    }
    const cards = await this.prisma.card.findMany({
      where: { projectId: link.projectId, deletedAt: null },
      orderBy: { zIndex: 'asc' },
    });
    const connections = await this.prisma.connection.findMany({
      where: {
        projectId: link.projectId,
        deletedAt: null,
        sourceCard: { deletedAt: null },
        targetCard: { deletedAt: null },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { project, cards, connections };
  }
}
