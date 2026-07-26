import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ConnectionsService } from './connections.service';

type PrismaArg = ConstructorParameters<typeof ConnectionsService>[0];

interface ConnectionMock {
  project: { findFirst: jest.Mock };
  card: { findFirst: jest.Mock };
  connection: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
}

function createPrismaMock(): ConnectionMock {
  return {
    project: { findFirst: jest.fn().mockResolvedValue({ id: 'proj-1' }) },
    // Both endpoint-card lookups succeed by default (cards are in the project).
    card: { findFirst: jest.fn().mockResolvedValue({ id: 'card-x' }) },
    connection: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      update: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'conn-1' }),
    },
  };
}

function makeService(mock: ConnectionMock): ConnectionsService {
  return new ConnectionsService(mock as unknown as PrismaArg);
}

describe('ConnectionsService', () => {
  it('list() checks project ownership then scopes to the project', async () => {
    const mock = createPrismaMock();
    await makeService(mock).list('user-1', 'proj-1');
    expect(mock.project.findFirst.mock.calls[0][0]).toMatchObject({
      where: { id: 'proj-1', ownerId: 'user-1' },
    });
    expect(mock.connection.findMany.mock.calls[0][0]).toMatchObject({
      where: { projectId: 'proj-1' },
    });
  });

  it('list() throws 404 when the project is not the caller’s', async () => {
    const mock = createPrismaMock();
    mock.project.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).list('user-1', 'proj-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mock.connection.findMany).not.toHaveBeenCalled();
  });

  it('create() verifies both endpoint cards and forwards the arrow data', async () => {
    const mock = createPrismaMock();
    await makeService(mock).create('user-1', 'proj-1', {
      sourceCardId: 'card-a',
      targetCardId: 'card-b',
      color: '#112233',
    });
    // Each card is scoped by id + projectId + owner.
    expect(mock.card.findFirst.mock.calls[0][0]).toMatchObject({
      where: { id: 'card-a', projectId: 'proj-1', project: { ownerId: 'user-1' } },
    });
    expect(mock.card.findFirst.mock.calls[1][0]).toMatchObject({
      where: { id: 'card-b', projectId: 'proj-1', project: { ownerId: 'user-1' } },
    });
    expect(mock.connection.create.mock.calls[0][0]).toMatchObject({
      data: {
        projectId: 'proj-1',
        sourceCardId: 'card-a',
        targetCardId: 'card-b',
        color: '#112233',
      },
    });
  });

  it('create() rejects a self-connection (400) before touching cards', async () => {
    const mock = createPrismaMock();
    await expect(
      makeService(mock).create('user-1', 'proj-1', {
        sourceCardId: 'card-a',
        targetCardId: 'card-a',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mock.card.findFirst).not.toHaveBeenCalled();
    expect(mock.connection.create).not.toHaveBeenCalled();
  });

  it('create() throws 404 when the source card is not in the project', async () => {
    const mock = createPrismaMock();
    mock.card.findFirst.mockResolvedValueOnce(null); // source lookup fails
    await expect(
      makeService(mock).create('user-1', 'proj-1', {
        sourceCardId: 'card-a',
        targetCardId: 'card-b',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mock.connection.create).not.toHaveBeenCalled();
  });

  it('create() throws 404 when the target card is not in the project', async () => {
    const mock = createPrismaMock();
    mock.card.findFirst
      .mockResolvedValueOnce({ id: 'card-a' }) // source ok
      .mockResolvedValueOnce(null); // target fails
    await expect(
      makeService(mock).create('user-1', 'proj-1', {
        sourceCardId: 'card-a',
        targetCardId: 'card-b',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mock.connection.create).not.toHaveBeenCalled();
  });

  it('create() maps a unique-constraint violation to 409', async () => {
    const mock = createPrismaMock();
    mock.connection.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(
      makeService(mock).create('user-1', 'proj-1', {
        sourceCardId: 'card-a',
        targetCardId: 'card-b',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('getOwned() scopes by id + projectId + owner and 404s when missing', async () => {
    const mock = createPrismaMock();
    mock.connection.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).getOwned('user-1', 'proj-1', 'conn-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mock.connection.findFirst.mock.calls[0][0]).toMatchObject({
      where: { id: 'conn-x', projectId: 'proj-1', project: { ownerId: 'user-1' } },
    });
  });

  it('update() refuses (404) before mutating a connection the caller cannot reach', async () => {
    const mock = createPrismaMock();
    mock.connection.findFirst.mockResolvedValue(null);
    await expect(
      makeService(mock).update('user-1', 'proj-1', 'conn-x', { color: '#000000' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mock.connection.update).not.toHaveBeenCalled();
  });

  it('remove() refuses (404) before deleting a connection the caller cannot reach', async () => {
    const mock = createPrismaMock();
    mock.connection.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).remove('user-1', 'proj-1', 'conn-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mock.connection.delete).not.toHaveBeenCalled();
  });
});
