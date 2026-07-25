import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

type Agent = ReturnType<typeof request.agent>;

const PASSWORD = 'CorrectHorse9Battery';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    // Disable rate limiting for most tests; the rate-limit test re-enables it.
    process.env.SB_DISABLE_THROTTLE = '1';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.SB_DISABLE_THROTTLE;
    await app.close();
  });

  const server = (): ReturnType<NestExpressApplication['getHttpServer']> => app.getHttpServer();
  const uniqueEmail = (): string =>
    `e2e_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}@example.com`;

  // The CSRF token is bound to the session, so a fresh one is fetched after any
  // auth-state change (login/refresh) — mirroring what the SPA will do.
  async function csrf(agent: Agent): Promise<string> {
    const res = await agent.get('/api/auth/csrf').expect(200);
    return res.body.csrfToken as string;
  }

  it('completes the full session lifecycle (register → login → me → refresh → logout)', async () => {
    const agent = request.agent(server());
    const email = uniqueEmail();

    let token = await csrf(agent);
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ email, password: PASSWORD })
      .expect(201);

    const login = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(login.body.user.email).toBe(email);
    expect(login.body.user.passwordHash).toBeUndefined();

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.user.email).toBe(email);
    expect(me.body.user.passwordHash).toBeUndefined();

    token = await csrf(agent);
    await agent.post('/api/auth/refresh').set('X-CSRF-Token', token).expect(200);
    await agent.get('/api/auth/me').expect(200);

    token = await csrf(agent);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', token).expect(200);
    await agent.get('/api/auth/me').expect(401);
  });

  it('rejects a state-changing request with no CSRF token (403)', async () => {
    await request(server())
      .post('/api/auth/register')
      .send({ email: uniqueEmail(), password: PASSWORD })
      .expect(403);
  });

  it('rejects a password shorter than the policy (400)', async () => {
    const agent = request.agent(server());
    const token = await csrf(agent);
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ email: uniqueEmail(), password: 'short' })
      .expect(400);
  });

  it('rejects an unknown extra field (allowlist validation, 400)', async () => {
    const agent = request.agent(server());
    const token = await csrf(agent);
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ email: uniqueEmail(), password: PASSWORD, role: 'admin' })
      .expect(400);
  });

  it('rejects duplicate registration (409)', async () => {
    const agent = request.agent(server());
    const email = uniqueEmail();
    const token = await csrf(agent);
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ email, password: PASSWORD })
      .expect(201);
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ email, password: PASSWORD })
      .expect(409);
  });

  it('returns a generic 401 for a wrong password and sets no session cookie', async () => {
    const agent = request.agent(server());
    const email = uniqueEmail();
    let token = await csrf(agent);
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ email, password: PASSWORD })
      .expect(201);

    token = await csrf(agent);
    const res = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ email, password: 'definitely-wrong' })
      .expect(401);
    expect(res.body.message).toBe('Invalid email or password');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('locks an account after repeated failures — even the correct password is then rejected', async () => {
    const agent = request.agent(server());
    const email = uniqueEmail();
    let token = await csrf(agent);
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ email, password: PASSWORD })
      .expect(201);

    for (let i = 0; i < 5; i += 1) {
      token = await csrf(agent);
      await agent
        .post('/api/auth/login')
        .set('X-CSRF-Token', token)
        .send({ email, password: `wrong-${i}` })
        .expect(401);
    }
    token = await csrf(agent);
    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ email, password: PASSWORD })
      .expect(401);
  });

  it('rate-limits repeated login attempts (429)', async () => {
    process.env.SB_DISABLE_THROTTLE = '0';
    try {
      const agent = request.agent(server());
      const email = uniqueEmail();
      let saw429 = false;
      for (let i = 0; i < 8; i += 1) {
        const token = await csrf(agent);
        const res = await agent
          .post('/api/auth/login')
          .set('X-CSRF-Token', token)
          .send({ email, password: 'nope' });
        if (res.status === 429) {
          saw429 = true;
          break;
        }
      }
      expect(saw429).toBe(true);
    } finally {
      process.env.SB_DISABLE_THROTTLE = '1';
    }
  });
});
