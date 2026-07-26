import { NotFoundException } from '@nestjs/common';
import { CardsService } from './cards.service';

type PrismaArg = ConstructorParameters<typeof CardsService>[0];

interface CardMock {
  project: { findFirst: jest.Mock };
  card: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    aggregate: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
  };
  $transaction: jest.Mock;
}

function createPrismaMock(): CardMock {
  const mock: CardMock = {
    project: { findFirst: jest.fn().mockResolvedValue({ id: 'proj-1' }) },
    card: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _max: { zIndex: null } }),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'c1' }),
      update: jest.fn().mockResolvedValue({ id: 'c1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      delete: jest.fn().mockResolvedValue({ id: 'c1' }),
    },
    // $transaction is called two ways: with a callback (bringToFront) or with an
    // array of promises (bulkUpdate). Support both.
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: CardMock) => unknown)(mock),
    ),
  };
  return mock;
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

  it('create() forwards shape/color/rotation/fontSize when provided', async () => {
    const mock = createPrismaMock();
    await makeService(mock).create('user-1', 'proj-1', {
      x: 0,
      y: 0,
      shape: 'diamond',
      color: '#ff8800',
      rotation: 45,
      fontSize: 24,
    });
    expect(mock.card.create.mock.calls[0][0]).toMatchObject({
      data: { shape: 'diamond', color: '#ff8800', rotation: 45, fontSize: 24 },
    });
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

  it('remove() soft-deletes (sets deletedAt) rather than deleting the row', async () => {
    const mock = createPrismaMock();
    mock.card.findFirst.mockResolvedValue({ id: 'c1', projectId: 'proj-1' }); // owned
    await makeService(mock).remove('user-1', 'proj-1', 'c1');
    expect(mock.card.delete).not.toHaveBeenCalled();
    expect(mock.card.update.mock.calls[0][0]).toMatchObject({ where: { id: 'c1' } });
    expect(mock.card.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('remove() refuses (404) before mutating a card the caller cannot reach', async () => {
    const mock = createPrismaMock();
    mock.card.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).remove('user-1', 'proj-1', 'c-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mock.card.update).not.toHaveBeenCalled();
  });

  it('bulkUpdate() checks all ids are owned+live, then updates each in a transaction', async () => {
    const mock = createPrismaMock();
    mock.card.count.mockResolvedValue(2); // both ids owned+live
    await makeService(mock).bulkUpdate('user-1', 'proj-1', [
      { id: 'a', x: 1 },
      { id: 'b', color: '#112233' },
    ]);
    expect(mock.card.count.mock.calls[0][0]).toMatchObject({
      where: {
        id: { in: ['a', 'b'] },
        projectId: 'proj-1',
        project: { ownerId: 'user-1' },
        deletedAt: null,
      },
    });
    expect(mock.$transaction).toHaveBeenCalled();
    expect(mock.card.update.mock.calls[0][0]).toMatchObject({ where: { id: 'a' }, data: { x: 1 } });
    expect(mock.card.update.mock.calls[1][0]).toMatchObject({
      where: { id: 'b' },
      data: { color: '#112233' },
    });
  });

  it('bulkUpdate() throws 404 when any id is not owned+live', async () => {
    const mock = createPrismaMock();
    mock.card.count.mockResolvedValue(1); // only one of two matched
    await expect(
      makeService(mock).bulkUpdate('user-1', 'proj-1', [{ id: 'a' }, { id: 'b' }]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(mock.card.update).not.toHaveBeenCalled();
  });

  it('bulkDelete() soft-deletes many owned+live cards', async () => {
    const mock = createPrismaMock();
    mock.card.count.mockResolvedValue(2);
    await makeService(mock).bulkDelete('user-1', 'proj-1', ['a', 'b']);
    const call = mock.card.updateMany.mock.calls[0][0];
    expect(call).toMatchObject({ where: { id: { in: ['a', 'b'] }, projectId: 'proj-1' } });
    expect(call.data.deletedAt).toBeInstanceOf(Date);
  });

  it('bulkRestore() clears deletedAt and allows already-deleted targets', async () => {
    const mock = createPrismaMock();
    mock.card.count.mockResolvedValue(2);
    await makeService(mock).bulkRestore('user-1', 'proj-1', ['a', 'b']);
    // Ownership check must NOT filter deletedAt (targets are deleted).
    expect(mock.card.count.mock.calls[0][0].where.deletedAt).toBeUndefined();
    expect(mock.card.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: { in: ['a', 'b'] }, projectId: 'proj-1' },
      data: { deletedAt: null },
    });
  });

  it('bringToFront() allocates zIndex = max+1 server-side (never a client value)', async () => {
    const mock = createPrismaMock();
    mock.card.findFirst.mockResolvedValue({ id: 'c1', projectId: 'proj-1' }); // owned
    mock.card.aggregate.mockResolvedValue({ _max: { zIndex: 4 } });
    await makeService(mock).bringToFront('user-1', 'proj-1', 'c1');
    expect(mock.$transaction).toHaveBeenCalled();
    expect(mock.card.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'c1' },
      data: { zIndex: 5 },
    });
  });

  it('bringToFront() refuses (404) before mutating a card the caller cannot reach', async () => {
    const mock = createPrismaMock();
    mock.card.findFirst.mockResolvedValue(null);
    await expect(makeService(mock).bringToFront('user-1', 'proj-1', 'c-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mock.card.update).not.toHaveBeenCalled();
  });
});
