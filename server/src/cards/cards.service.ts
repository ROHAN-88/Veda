import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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

  async list(userId: string, projectId: string) {
    await this.assertProjectOwned(userId, projectId);
    return this.prisma.card.findMany({ where: { projectId }, orderBy: { zIndex: 'asc' } });
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
      where: { id, projectId, project: { ownerId: userId } },
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

  async remove(userId: string, projectId: string, id: string): Promise<void> {
    await this.getOwned(userId, projectId, id); // refuse (404) before deleting
    await this.prisma.card.delete({ where: { id } });
  }
}
