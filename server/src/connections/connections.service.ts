import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
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

  /** 404 unless `cardId` is in the caller's project. Guards both create endpoints. */
  private async assertCardInProject(
    userId: string,
    projectId: string,
    cardId: string,
  ): Promise<void> {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, projectId, project: { ownerId: userId } },
      select: { id: true },
    });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
  }

  async list(userId: string, projectId: string) {
    await this.assertProjectOwned(userId, projectId);
    return this.prisma.connection.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, projectId: string, dto: CreateConnectionDto) {
    await this.assertProjectOwned(userId, projectId);
    if (dto.sourceCardId === dto.targetCardId) {
      throw new BadRequestException('A card cannot be connected to itself');
    }
    // Both endpoints must be the caller's cards within THIS project.
    await this.assertCardInProject(userId, projectId, dto.sourceCardId);
    await this.assertCardInProject(userId, projectId, dto.targetCardId);
    try {
      return await this.prisma.connection.create({
        data: {
          projectId,
          sourceCardId: dto.sourceCardId,
          targetCardId: dto.targetCardId,
          color: dto.color,
        },
      });
    } catch (error) {
      // Unique constraint on (sourceCardId, targetCardId): arrow already exists.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Connection already exists');
      }
      throw error;
    }
  }

  async getOwned(userId: string, projectId: string, id: string) {
    const connection = await this.prisma.connection.findFirst({
      where: { id, projectId, project: { ownerId: userId } },
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
    await this.prisma.connection.delete({ where: { id } });
  }
}
