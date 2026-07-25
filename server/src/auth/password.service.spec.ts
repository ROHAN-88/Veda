import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  beforeAll(async () => {
    await service.onModuleInit();
  });

  it('hashes with argon2id and verifies the correct password', async () => {
    const hash = await service.hash('CorrectHorse9Battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'CorrectHorse9Battery')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('CorrectHorse9Battery');
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('produces distinct hashes for the same input (per-hash random salt)', async () => {
    const [a, b] = await Promise.all([
      service.hash('same-input-abc'),
      service.hash('same-input-abc'),
    ]);
    expect(a).not.toBe(b);
  });

  it('verifyDummy resolves without throwing (timing equalizer)', async () => {
    await expect(service.verifyDummy('anything')).resolves.toBeUndefined();
  });
});
