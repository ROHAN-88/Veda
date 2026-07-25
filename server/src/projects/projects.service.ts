import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';

/**
 * Project (workspace) CRUD. EVERY query is scoped to the owner — this is the
 * app's per-user authorization boundary (OWASP A01 / CWE-639/862/863). `/:id`
 * operations resolve through {@link getOwned}, which returns 404 (not 403) for a
 * project the caller doesn't own, so a guessed id can't confirm its existence.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({ data: { ownerId: userId, name: dto.name } });
  }

  list(userId: string) {
    return this.prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOwned(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({ where: { id, ownerId: userId } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(userId: string, id: string, dto: UpdateProjectDto) {
    await this.getOwned(userId, id);
    return this.prisma.project.update({ where: { id }, data: { name: dto.name } });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getOwned(userId, id);
    await this.prisma.project.delete({ where: { id } });
  }
}
