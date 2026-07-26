import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateConnectionDto } from './dto/create-connection.dto';
import type { UpdateConnectionDto } from './dto/update-connection.dto';

/**
 * Relation-arrow CRUD, scoped to the authenticated user AND the URL's project.
 * Every single-connection query filters on `{ id, projectId, project: { ownerId } }`,
 * so a connection that isn't the caller's — or isn't in the URL's project —
 * resolves to 404 (never 403). On create, BOTH endpoint cards are verified to
 * live in that same owned project, which prevents linking to a card in another
 * user's (or another) project. This is the per-user + per-project IDOR boundary
 * (OWASP A01 / CWE-639); the DB relations are the boundary.
 */
@Injectable()
export class ConnectionsService {
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

  /** 404 unless `cardId` is a LIVE card in the caller's project. Guards create. */
  private async assertCardInProject(
    userId: string,
    projectId: string,
    cardId: string,
  ): Promise<void> {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, projectId, project: { ownerId: userId }, deletedAt: null },
      select: { id: true },
    });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
  }

  /** 404 unless EVERY id is the caller's connection in this project. Returns unique ids. */
  private async assertConnectionsOwned(
    userId: string,
    projectId: string,
    ids: string[],
    includeDeleted = false,
  ): Promise<string[]> {
    const unique = [...new Set(ids)];
    const count = await this.prisma.connection.count({
      where: {
        id: { in: unique },
        projectId,
        project: { ownerId: userId },
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
    if (count !== unique.length) {
      throw new NotFoundException('Connection not found');
    }
    return unique;
  }

  async list(userId: string, projectId: string) {
    await this.assertProjectOwned(userId, projectId);
    // Hide soft-deleted arrows AND arrows whose endpoint card is soft-deleted.
    return this.prisma.connection.findMany({
      where: {
        projectId,
        deletedAt: null,
        sourceCard: { deletedAt: null },
        targetCard: { deletedAt: null },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, projectId: string, dto: CreateConnectionDto) {
    await this.assertProjectOwned(userId, projectId);
    if (dto.sourceCardId === dto.targetCardId) {
      throw new BadRequestException('A card cannot be connected to itself');
    }
    // Both endpoints must be the caller's LIVE cards within THIS project.
    await this.assertCardInProject(userId, projectId, dto.sourceCardId);
    await this.assertCardInProject(userId, projectId, dto.targetCardId);
    // A soft-deleted arrow still occupies the unique (source, target) slot — reuse
    // it (restore) so re-connecting keeps the same id (clean redo) and respects the
    // unique index; a live duplicate is a 409.
    const existing = await this.prisma.connection.findUnique({
      where: {
        sourceCardId_targetCardId: {
          sourceCardId: dto.sourceCardId,
          targetCardId: dto.targetCardId,
        },
      },
    });
    if (existing) {
      if (existing.deletedAt === null) {
        throw new ConflictException('Connection already exists');
      }
      return this.prisma.connection.update({
        where: { id: existing.id },
        data: { deletedAt: null, color: dto.color ?? existing.color },
      });
    }
    return this.prisma.connection.create({
      data: {
        projectId,
        sourceCardId: dto.sourceCardId,
        targetCardId: dto.targetCardId,
        color: dto.color,
      },
    });
  }

  async getOwned(userId: string, projectId: string, id: string) {
    const connection = await this.prisma.connection.findFirst({
      where: { id, projectId, project: { ownerId: userId }, deletedAt: null },
    });
    if (!connection) {
      throw new NotFoundException('Connection not found');
    }
    return connection;
  }

  async update(userId: string, projectId: string, id: string, dto: UpdateConnectionDto) {
    await this.getOwned(userId, projectId, id); // refuse (404) before mutating
    return this.prisma.connection.update({ where: { id }, data: { ...dto } });
  }

  async remove(userId: string, projectId: string, id: string): Promise<void> {
    await this.getOwned(userId, projectId, id); // refuse (404) before deleting
    // Soft delete (Phase 8) so undo can restore the arrow with its original id.
    await this.prisma.connection.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /** Soft-delete many arrows at once. Every id must be owned + live. */
  async bulkDelete(userId: string, projectId: string, ids: string[]): Promise<void> {
    const unique = await this.assertConnectionsOwned(userId, projectId, ids);
    await this.prisma.connection.updateMany({
      where: { id: { in: unique }, projectId },
      data: { deletedAt: new Date() },
    });
  }

  /** Restore many soft-deleted arrows (undo of delete). Every id must be owned. */
  async bulkRestore(userId: string, projectId: string, ids: string[]): Promise<void> {
    const unique = await this.assertConnectionsOwned(userId, projectId, ids, true);
    await this.prisma.connection.updateMany({
      where: { id: { in: unique }, projectId },
      data: { deletedAt: null },
    });
  }
}
