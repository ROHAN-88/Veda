import { createHash } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { ShareService } from './share.service';

type PrismaArg = ConstructorParameters<typeof ShareService>[0];

interface ShareMock {
  project: { findFirst: jest.Mock; findUnique: jest.Mock };
  shareLink: { updateMany: jest.Mock; create: jest.Mock; findFirst: jest.Mock };
  card: { findMany: jest.Mock };
  connection: { findMany: jest.Mock };
  $transaction: jest.Mock;
}

function createPrismaMock(): ShareMock {
  const mock: ShareMock = {
    project: {
      findFirst: jest.fn().mockResolvedValue({ id: 'p1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'p1', name: 'Board' }),
    },
    shareLink: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'link-1', createdAt: new Date(0) }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    card: { findMany: jest.fn().mockResolvedValue([]) },
    connection: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: ShareMock) => unknown)(mock),
    ),
  };
  return mock;
}

function makeService(mock: ShareMock): ShareService {
  return new ShareService(mock as unknown as PrismaArg);
}

const sha256 = (raw: string) => createHash('sha256').update(raw).digest('hex');

describe('ShareService', () => {
  describe('create', () => {
    it('revokes existing links, stores only the token HASH, and returns the raw token once', async () => {
      const mock = createPrismaMock();
      const result = await makeService(mock).create('user-1', 'p1');

      expect(result.token).toEqual(expect.any(String));
      expect(result.token.length).toBeGreaterThan(20);
      // prior active links revoked, then a fresh one created
      expect(mock.shareLink.updateMany.mock.calls[0][0]).toMatchObject({
        where: { projectId: 'p1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      // the DB never sees the raw token — only sha256(token)
      const stored = mock.shareLink.create.mock.calls[0][0].data.tokenHash as string;
      expect(stored).toBe(sha256(result.token));
      expect(stored).not.toContain(result.token);
    });

    it('throws 404 for a project the caller does not own', async () => {
      const mock = createPrismaMock();
      mock.project.findFirst.mockResolvedValue(null);
      await expect(makeService(mock).create('user-1', 'p-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mock.shareLink.create).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('reports active with the link createdAt', async () => {
      const mock = createPrismaMock();
      mock.shareLink.findFirst.mockResolvedValue({ createdAt: new Date(0) });
      expect(await makeService(mock).getStatus('user-1', 'p1')).toEqual({
        active: true,
        createdAt: new Date(0),
      });
    });

    it('reports inactive when no live link exists', async () => {
      const mock = createPrismaMock();
      expect(await makeService(mock).getStatus('user-1', 'p1')).toEqual({
        active: false,
        createdAt: null,
      });
    });
  });

  describe('revoke', () => {
    it('revokes the active link scoped to the project', async () => {
      const mock = createPrismaMock();
      await makeService(mock).revoke('user-1', 'p1');
      expect(mock.shareLink.updateMany.mock.calls[0][0]).toMatchObject({
        where: { projectId: 'p1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('throws 404 for a non-owned project', async () => {
      const mock = createPrismaMock();
      mock.project.findFirst.mockResolvedValue(null);
      await expect(makeService(mock).revoke('user-1', 'p-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mock.shareLink.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('readByToken', () => {
    it('looks up by token hash + not-revoked and returns the live board', async () => {
      const mock = createPrismaMock();
      mock.shareLink.findFirst.mockResolvedValue({ projectId: 'p1' });
      mock.card.findMany.mockResolvedValue([{ id: 'c1' }]);

      const board = await makeService(mock).readByToken('raw-token');

      expect(mock.shareLink.findFirst.mock.calls[0][0]).toMatchObject({
        where: { tokenHash: sha256('raw-token'), revokedAt: null },
      });
      expect(board.project).toEqual({ id: 'p1', name: 'Board' });
      expect(board.cards).toEqual([{ id: 'c1' }]);
    });

    it('throws 404 for an unknown or revoked token (no existence leak)', async () => {
      const mock = createPrismaMock(); // shareLink.findFirst → null by default
      await expect(makeService(mock).readByToken('nope')).rejects.toBeInstanceOf(NotFoundException);
      expect(mock.card.findMany).not.toHaveBeenCalled();
    });
  });
});
