import { NOTES_CARDS_MAX, NotesService } from './notes.service';

type PrismaArg = ConstructorParameters<typeof NotesService>[0];

interface CardMock {
  card: { findMany: jest.Mock };
}

function createPrismaMock(): CardMock {
  return { card: { findMany: jest.fn().mockResolvedValue([]) } };
}

function makeService(mock: CardMock): NotesService {
  return new NotesService(mock as unknown as PrismaArg);
}

describe('NotesService', () => {
  const argsFor = async (userId: string) => {
    const mock = createPrismaMock();
    await makeService(mock).list(userId);
    return mock.card.findMany.mock.calls[0][0];
  };

  // The where-clause IS the authorization boundary — there is no preceding
  // ownership check to fall back on, so this assertion is the security test.
  it('scopes to cards whose project the caller owns', async () => {
    expect((await argsFor('user-1')).where.project).toMatchObject({ ownerId: 'user-1' });
  });

  it('only includes projects opted into the combined view', async () => {
    expect((await argsFor('user-1')).where.project).toMatchObject({ notesIncluded: true });
  });

  it('excludes soft-deleted cards', async () => {
    expect((await argsFor('user-1')).where.deletedAt).toBeNull();
  });

  // Unbounded, this is the one query whose size grows with the whole account.
  it('caps the result set', async () => {
    expect((await argsFor('user-1')).take).toBe(NOTES_CARDS_MAX);
  });

  it('orders by project first so each board stays contiguous', async () => {
    expect((await argsFor('user-1')).orderBy).toEqual([{ projectId: 'asc' }, { zIndex: 'asc' }]);
  });

  it('never filters by a caller-supplied project id', async () => {
    const where = (await argsFor('user-1')).where;
    expect(where.projectId).toBeUndefined();
  });
});
