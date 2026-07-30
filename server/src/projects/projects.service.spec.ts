import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

type PrismaArg = ConstructorParameters<typeof ProjectsService>[0];

interface ProjectMock {
  project: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
}

function createPrismaMock(): ProjectMock {
  return {
    project: {
      create: jest.fn().mockResolvedValue({ id: 'p1' }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'p1', name: 'new' }),
      delete: jest.fn().mockResolvedValue({ id: 'p1' }),
    },
  };
}

function makeService(mock: ProjectMock): ProjectsService {
  return new ProjectsService(mock as unknown as PrismaArg);
}

describe('ProjectsService', () => {
  it('list() scopes the query to the owner', async () => {
    const mock = createPrismaMock();
    await makeService(mock).list('user-1');
    expect(mock.project.findMany.mock.calls[0][0]).toMatchObject({ where: { ownerId: 'user-1' } });
  });

  it('create() sets ownerId from the caller', async () => {
    const mock = createPrismaMock();
    await makeService(mock).create('user-1', { name: 'Board' });
    expect(mock.project.create.mock.calls[0][0]).toMatchObject({
      data: { ownerId: 'user-1', name: 'Board' },
    });
  });

  it('getOwned() throws 404 for a project the caller does not own', async () => {
    const mock = createPrismaMock();
    mock.project.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).getOwned('user-1', 'p-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update() refuses (404) before touching a non-owned project', async () => {
    const mock = createPrismaMock();
    mock.project.findFirst.mockResolvedValue(null);
    await expect(
      makeService(mock).update('user-1', 'p-other', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mock.project.update).not.toHaveBeenCalled();
  });

  it('remove() refuses (404) before deleting a non-owned project', async () => {
    const mock = createPrismaMock();
    mock.project.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).remove('user-1', 'p-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mock.project.delete).not.toHaveBeenCalled();
  });
});
