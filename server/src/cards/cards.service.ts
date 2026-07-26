import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BulkCardUpdateItem } from './dto/bulk-cards.dto';
import type { CreateCardDto } from './dto/create-card.dto';
import type { UpdateCardDto } from './dto/update-card.dto';

/**
 * Card CRUD, scoped to the authenticated user AND the URL's project. Every
 * single-card query filters on `{ id, projectId, project: { ownerId } }`, so a
 * card that isn't the caller's — or doesn't belong to the project named in the
 * URL — resolves to 404 (never 403). This is the per-user + per-project IDOR
 * boundary (OWASP A01 / CWE-639); the DB relation is the boundary, so no
 * ProjectsService dependency is needed.
 */
@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 404 unless `projectId` exists AND belongs to the caller. Guards create/list. */
  private async assertProjectOwned(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  /**
   * 404 unless EVERY id is the caller's card in this project. Returns the unique
   * ids. `includeDeleted` = true for restore (the targets are soft-deleted).
   */
  private async assertCardsOwned(
    userId: string,
    projectId: string,
    ids: string[],
    includeDeleted = false,
  ): Promise<string[]> {
    const unique = [...new Set(ids)];
    const count = await this.prisma.card.count({
      where: {
        id: { in: unique },
        projectId,
        project: { ownerId: userId },
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
    if (count !== unique.length) {
      throw new NotFoundException('Card not found');
    }
    return unique;
  }

  async list(userId: string, projectId: string) {
    await this.assertProjectOwned(userId, projectId);
    return this.prisma.card.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { zIndex: 'asc' },
    });
  }

  async create(userId: string, projectId: string, dto: CreateCardDto) {
    await this.assertProjectOwned(userId, projectId);
    const agg = await this.prisma.card.aggregate({
      where: { projectId },
      _max: { zIndex: true },
    });
    const nextZIndex = (agg._max.zIndex ?? -1) + 1; // first card => 0, else max+1
    return this.prisma.card.create({
      data: {
        projectId,
        x: dto.x,
        y: dto.y,
        w: dto.w,
        h: dto.h,
        content: dto.content,
        shape: dto.shape,
        color: dto.color,
        rotation: dto.rotation,
        fontSize: dto.fontSize,
        zIndex: nextZIndex,
      },
    });
  }

  async getOwned(userId: string, projectId: string, id: string) {
    const card = await this.prisma.card.findFirst({
      where: { id, projectId, project: { ownerId: userId }, deletedAt: null },
    });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    return card;
  }

  async update(userId: string, projectId: string, id: string, dto: UpdateCardDto) {
    await this.getOwned(userId, projectId, id); // refuse (404) before mutating
    return this.prisma.card.update({ where: { id }, data: { ...dto } });
  }

  /**
   * Raise a card to the top of the stack. `zIndex` is allocated server-side
   * (max+1, recomputed from committed DB state) rather than trusting a
   * client-sent value — this removes the stale-cache / concurrent-tab race where
   * two clients both wrote `max+1` and tied. Runs in a transaction so the read and
   * write are one unit.
   */
  async bringToFront(userId: string, projectId: string, id: string) {
    await this.getOwned(userId, projectId, id); // refuse (404) before mutating
    return this.prisma.$transaction(async (tx) => {
      const agg = await tx.card.aggregate({ where: { projectId }, _max: { zIndex: true } });
      const top = agg._max.zIndex ?? -1;
      return tx.card.update({ where: { id }, data: { zIndex: top + 1 } });
    });
  }

  async remove(userId: string, projectId: string, id: string): Promise<void> {
    await this.getOwned(userId, projectId, id); // refuse (404) before deleting
    // Soft delete (Phase 8): keep the row so undo can restore it (same id, zIndex,
    // arrows). Its arrows are hidden while it's deleted (connection list filter).
    await this.prisma.card.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Atomic multi-card update (group move / recolor / …). Every id must be owned + live. */
  async bulkUpdate(userId: string, projectId: string, items: BulkCardUpdateItem[]) {
    await this.assertCardsOwned(
      userId,
      projectId,
      items.map((item) => item.id),
    );
    return this.prisma.$transaction(
      items.map(({ id, ...patch }) =>
        this.prisma.card.update({ where: { id }, data: { ...patch } }),
      ),
    );
  }

  /** Soft-delete many cards at once (group delete). Every id must be owned + live. */
  async bulkDelete(userId: string, projectId: string, ids: string[]): Promise<void> {
    const unique = await this.assertCardsOwned(userId, projectId, ids);
    await this.prisma.card.updateMany({
      where: { id: { in: unique }, projectId },
      data: { deletedAt: new Date() },
    });
  }

  /** Restore many soft-deleted cards (undo of delete). Every id must be owned. */
  async bulkRestore(userId: string, projectId: string, ids: string[]): Promise<void> {
    const unique = await this.assertCardsOwned(userId, projectId, ids, true);
    await this.prisma.card.updateMany({
      where: { id: { in: unique }, projectId },
      data: { deletedAt: null },
    });
  }
}
