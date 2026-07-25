import { NotFoundException } from '@nestjs/common';
import { CardsService } from './cards.service';

type PrismaArg = ConstructorParameters<typeof CardsService>[0];

interface CardMock {
  project: { findFirst: jest.Mock };
  card: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    aggregate: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
}

function createPrismaMock(): CardMock {
  return {
    project: { findFirst: jest.fn().mockResolvedValue({ id: 'proj-1' }) },
    card: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _max: { zIndex: null } }),
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
      update: jest.fn().mockResolvedValue({ id: 'c1' }),
      delete: jest.fn().mockResolvedValue({ id: 'c1' }),
    },
  };
}

function makeService(mock: CardMock): CardsService {
  return new CardsService(mock as unknown as PrismaArg);
}

describe('CardsService', () => {
  it('list() checks project ownership then scopes to the project', async () => {
    const mock = createPrismaMock();
    await makeService(mock).list('user-1', 'proj-1');
    expect(mock.project.findFirst.mock.calls[0][0]).toMatchObject({
      where: { id: 'proj-1', ownerId: 'user-1' },
    });
    expect(mock.card.findMany.mock.calls[0][0]).toMatchObject({ where: { projectId: 'proj-1' } });
  });

  it('list() throws 404 when the project is not the caller’s', async () => {
    const mock = createPrismaMock();
    mock.project.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).list('user-1', 'proj-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mock.card.findMany).not.toHaveBeenCalled();
  });

  it('create() assigns zIndex 0 for the first card and sets projectId from the param', async () => {
    const mock = createPrismaMock();
    mock.card.aggregate.mockResolvedValue({ _max: { zIndex: null } });
    await makeService(mock).create('user-1', 'proj-1', { x: 1, y: 2 });
    expect(mock.card.create.mock.calls[0][0]).toMatchObject({
      data: { projectId: 'proj-1', x: 1, y: 2, zIndex: 0 },
    });
  });

  it('create() assigns max+1 for a subsequent card', async () => {
    const mock = createPrismaMock();
    mock.card.aggregate.mockResolvedValue({ _max: { zIndex: 4 } });
    await makeService(mock).create('user-1', 'proj-1', { x: 0, y: 0 });
    expect(mock.card.create.mock.calls[0][0]).toMatchObject({ data: { zIndex: 5 } });
  });

  it('getOwned() scopes by id + projectId + owner and 404s when missing', async () => {
    const mock = createPrismaMock();
    mock.card.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).getOwned('user-1', 'proj-1', 'c-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mock.card.findFirst.mock.calls[0][0]).toMatchObject({
      where: { id: 'c-x', projectId: 'proj-1', project: { ownerId: 'user-1' } },
    });
  });

  it('update() refuses (404) before mutating a card the caller cannot reach', async () => {
    const mock = createPrismaMock();
    mock.card.findFirst.mockResolvedValue(null);
    await expect(
      makeService(mock).update('user-1', 'proj-1', 'c-x', { x: 9 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mock.card.update).not.toHaveBeenCalled();
  });

  it('remove() refuses (404) before deleting a card the caller cannot reach', async () => {
    const mock = createPrismaMock();
    mock.card.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).remove('user-1', 'proj-1', 'c-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mock.card.delete).not.toHaveBeenCalled();
  });
});
