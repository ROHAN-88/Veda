import { SessionService } from './session.service';

type PrismaArg = ConstructorParameters<typeof SessionService>[0];

interface SessionMock {
  session: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
}

function createPrismaMock(): SessionMock {
  return {
    session: {
      create: jest.fn().mockResolvedValue(undefined),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

const future = (): Date => new Date(Date.now() + 60_000);
const past = (): Date => new Date(Date.now() - 60_000);
const baseUser = () => ({
  id: 'user-1',
  email: 'a@b.com',
  passwordHash: 'argon2-hash',
  failedLoginCount: 0,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeService(mock: SessionMock): SessionService {
  return new SessionService(mock as unknown as PrismaArg);
}

describe('SessionService', () => {
  it('create() persists a 64-char sha256 hash, never the raw token', async () => {
    const mock = createPrismaMock();
    const raw = await makeService(mock).create('user-1', {});
    const { data } = mock.session.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(raw.length).toBeGreaterThan(20);
    expect(data.tokenHash).toHaveLength(64);
    expect(data.tokenHash).not.toEqual(raw);
    expect(Object.values(data)).not.toContain(raw);
  });

  it('validate() returns null for a revoked session', async () => {
    const mock = createPrismaMock();
    mock.session.findUnique.mockResolvedValue({
      id: 's1',
      revokedAt: new Date(),
      expiresAt: future(),
      absoluteExpiresAt: future(),
      user: baseUser(),
    });
    await expect(makeService(mock).validate('token')).resolves.toBeNull();
  });

  it('validate() returns null past the sliding expiry', async () => {
    const mock = createPrismaMock();
    mock.session.findUnique.mockResolvedValue({
      id: 's1',
      revokedAt: null,
      expiresAt: past(),
      absoluteExpiresAt: future(),
      user: baseUser(),
    });
    await expect(makeService(mock).validate('token')).resolves.toBeNull();
  });

  it('validate() returns a SafeUser without passwordHash for an active session', async () => {
    const mock = createPrismaMock();
    mock.session.findUnique.mockResolvedValue({
      id: 's1',
      revokedAt: null,
      expiresAt: future(),
      absoluteExpiresAt: future(),
      user: baseUser(),
    });
    const result = await makeService(mock).validate('token');
    expect(result?.user.email).toBe('a@b.com');
    expect(Object.keys(result?.user ?? {})).not.toContain('passwordHash');
  });

  it('rotate() issues a new token bounded by the absolute cap', async () => {
    const mock = createPrismaMock();
    const absolute = new Date(Date.now() + 1_000); // cap is very close
    mock.session.findUnique.mockResolvedValue({
      id: 's1',
      revokedAt: null,
      expiresAt: future(),
      absoluteExpiresAt: absolute,
      user: baseUser(),
    });
    const newRaw = await makeService(mock).rotate('old-token', {});
    expect(newRaw).not.toBeNull();
    const { data } = mock.session.update.mock.calls[0][0] as { data: { expiresAt: Date } };
    expect(data.expiresAt.getTime()).toBeLessThanOrEqual(absolute.getTime());
  });

  it('revoke() marks only non-revoked matching sessions as revoked', async () => {
    const mock = createPrismaMock();
    await makeService(mock).revoke('token');
    const arg = mock.session.updateMany.mock.calls[0][0] as {
      where: { revokedAt: null };
      data: { revokedAt: Date };
    };
    expect(arg.where.revokedAt).toBeNull();
    expect(arg.data.revokedAt).toBeInstanceOf(Date);
  });
});
