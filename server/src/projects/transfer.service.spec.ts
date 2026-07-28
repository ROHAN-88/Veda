import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectTransferService } from './transfer.service';

type PrismaArg = ConstructorParameters<typeof ProjectTransferService>[0];

interface TransferMock {
  project: { create: jest.Mock; findFirst: jest.Mock };
  card: { findMany: jest.Mock; createMany: jest.Mock };
  connection: { findMany: jest.Mock; createMany: jest.Mock };
  $transaction: jest.Mock;
}

function createPrismaMock(): TransferMock {
  const mock: TransferMock = {
    project: {
      create: jest.fn().mockResolvedValue({ id: 'new-proj', name: 'Imported' }),
      findFirst: jest.fn().mockResolvedValue({ id: 'p1', name: 'Board' }),
    },
    card: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    connection: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    // create() uses the callback form; array form is unused here but supported.
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: TransferMock) => unknown)(mock),
    ),
  };
  return mock;
}

function makeService(mock: TransferMock): ProjectTransferService {
  const projects = new ProjectsService(mock as unknown as PrismaArg);
  return new ProjectTransferService(mock as unknown as PrismaArg, projects);
}

const card = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  x: 1,
  y: 2,
  w: 240,
  h: 160,
  content: '',
  shape: 'card',
  color: '#ffffff',
  rotation: 0,
  fontSize: 14,
  ...over,
});

describe('ProjectTransferService', () => {
  describe('exportProject', () => {
    it('serializes an id-free, versioned document (refs = card ids)', async () => {
      const mock = createPrismaMock();
      mock.card.findMany.mockResolvedValue([card('a'), card('b', { content: 'B' })]);
      mock.connection.findMany.mockResolvedValue([
        { sourceCardId: 'a', targetCardId: 'b', color: '#64748b' },
      ]);

      const doc = await makeService(mock).exportProject('user-1', 'p1');

      expect(doc.version).toBe(1);
      expect(doc.project).toEqual({ name: 'Board' });
      expect(doc.cards.map((c) => c.ref)).toEqual(['a', 'b']);
      expect(doc.cards[0]).not.toHaveProperty('id');
      expect(doc.connections).toEqual([{ sourceRef: 'a', targetRef: 'b', color: '#64748b' }]);
    });

    it('reads only live rows (deletedAt: null) in stacking order', async () => {
      const mock = createPrismaMock();
      await makeService(mock).exportProject('user-1', 'p1');
      expect(mock.card.findMany.mock.calls[0][0]).toMatchObject({
        where: { projectId: 'p1', deletedAt: null },
        orderBy: { zIndex: 'asc' },
      });
    });

    it('throws 404 for a project the caller does not own', async () => {
      const mock = createPrismaMock();
      mock.project.findFirst.mockResolvedValue(null);
      await expect(makeService(mock).exportProject('user-1', 'p-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mock.card.findMany).not.toHaveBeenCalled();
    });
  });

  describe('importProject', () => {
    const dto = (over: Record<string, unknown> = {}) => ({
      version: 1,
      project: { name: 'Imported' },
      cards: [
        { ref: 'x0', x: 0, y: 0 },
        { ref: 'x1', x: 5, y: 5 },
      ],
      connections: [{ sourceRef: 'x0', targetRef: 'x1', color: '#112233' }],
      ...over,
    });

    it('mints fresh ids, sets zIndex from order, and remaps arrows', async () => {
      const mock = createPrismaMock();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await makeService(mock).importProject('user-1', dto() as any);

      const cardRows = mock.card.createMany.mock.calls[0][0].data as {
        id: string;
        zIndex: number;
      }[];
      expect(cardRows).toHaveLength(2);
      expect(cardRows.map((c) => c.zIndex)).toEqual([0, 1]);
      expect(cardRows[0].id).not.toBe('x0'); // server-minted, not the file's ref

      const connRows = mock.connection.createMany.mock.calls[0][0].data as {
        sourceCardId: string;
        targetCardId: string;
      }[];
      expect(connRows).toHaveLength(1);
      expect(connRows[0].sourceCardId).toBe(cardRows[0].id);
      expect(connRows[0].targetCardId).toBe(cardRows[1].id);
    });

    it('drops self-loops, unknown refs, and duplicate ordered pairs', async () => {
      const mock = createPrismaMock();
      const payload = dto({
        connections: [
          { sourceRef: 'x0', targetRef: 'x0' }, // self-loop
          { sourceRef: 'x0', targetRef: 'zzz' }, // dangling ref
          { sourceRef: 'x0', targetRef: 'x1' }, // keep
          { sourceRef: 'x0', targetRef: 'x1' }, // duplicate
        ],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await makeService(mock).importProject('user-1', payload as any);
      expect(mock.connection.createMany.mock.calls[0][0].data).toHaveLength(1);
    });

    it('skips createMany when there are no surviving connections', async () => {
      const mock = createPrismaMock();
      const payload = dto({ connections: [{ sourceRef: 'x0', targetRef: 'x0' }] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await makeService(mock).importProject('user-1', payload as any);
      expect(mock.connection.createMany).not.toHaveBeenCalled();
    });

    it('sets the new project owner to the caller', async () => {
      const mock = createPrismaMock();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await makeService(mock).importProject('user-1', dto() as any);
      expect(mock.project.create.mock.calls[0][0]).toMatchObject({
        data: { ownerId: 'user-1', name: 'Imported' },
      });
    });
  });
});

// Guards the hashing convention referenced by ShareService too.
it('sha256 hex is 64 chars (token-hash convention sanity)', () => {
  expect(createHash('sha256').update('x').digest('hex')).toHaveLength(64);
});
