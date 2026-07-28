import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

type Agent = ReturnType<typeof request.agent>;
const PASSWORD = 'CorrectHorse9Battery';

describe('Share links (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
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
    `share_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}@example.com`;

  async function csrf(agent: Agent): Promise<string> {
    return (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken as string;
  }

  async function authedAgent(): Promise<Agent> {
    const agent = request.agent(server());
    const email = uniqueEmail();
    const token = await csrf(agent);
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', token)
      .send({ email, password: PASSWORD })
      .expect(201);
    await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', token)
      .send({ email, password: PASSWORD })
      .expect(200);
    return agent;
  }

  async function createProject(agent: Agent, name = 'Board'): Promise<string> {
    const token = await csrf(agent);
    const res = await agent
      .post('/api/projects')
      .set('X-CSRF-Token', token)
      .send({ name })
      .expect(201);
    return res.body.id as string;
  }

  async function createShare(agent: Agent, projectId: string): Promise<string> {
    const token = await csrf(agent);
    const res = await agent
      .post(`/api/projects/${projectId}/share`)
      .set('X-CSRF-Token', token)
      .expect(201);
    return res.body.token as string;
  }

  it('creates a live public link readable with no auth and no CSRF', async () => {
    const alice = await authedAgent();
    const pid = await createProject(alice, 'Shared board');
    const cardToken = await csrf(alice);
    await alice
      .post(`/api/projects/${pid}/cards`)
      .set('X-CSRF-Token', cardToken)
      .send({ x: 5, y: 5, content: 'visible' })
      .expect(201);

    const shareToken = await createShare(alice, pid);

    // A brand-new agent with no cookies/session and no CSRF token can read it.
    const anon = request(server());
    const board = (await anon.get(`/api/share/${shareToken}`).expect(200)).body;
    expect(board.project).toEqual({ id: pid, name: 'Shared board' });
    expect(board.cards).toHaveLength(1);
    expect(board.cards[0].content).toBe('visible');
    // Public payload must not leak ownership/user data.
    expect(board.project).not.toHaveProperty('ownerId');
  });

  it('reports owner status and revokes (revoked → public 404)', async () => {
    const alice = await authedAgent();
    const pid = await createProject(alice);
    const shareToken = await createShare(alice, pid);

    const status = (await alice.get(`/api/projects/${pid}/share`).expect(200)).body;
    expect(status.active).toBe(true);
    expect(status.createdAt).toEqual(expect.any(String));

    const del = await csrf(alice);
    await alice.delete(`/api/projects/${pid}/share`).set('X-CSRF-Token', del).expect(204);

    await request(server()).get(`/api/share/${shareToken}`).expect(404);
    const after = (await alice.get(`/api/projects/${pid}/share`).expect(200)).body;
    expect(after.active).toBe(false);
  });

  it('keeps at most one active link (creating a second revokes the first)', async () => {
    const alice = await authedAgent();
    const pid = await createProject(alice);
    const first = await createShare(alice, pid);
    const second = await createShare(alice, pid);

    await request(server()).get(`/api/share/${first}`).expect(404); // superseded
    await request(server()).get(`/api/share/${second}`).expect(200);
  });

  it('returns 404 for an unknown token (no existence leak)', async () => {
    await request(server()).get('/api/share/not-a-real-token').expect(404);
  });

  it('prevents IDOR: user B cannot share/inspect/revoke user A’s project (404)', async () => {
    const alice = await authedAgent();
    const bob = await authedAgent();
    const pid = await createProject(alice, 'Alice only');

    const bobToken = await csrf(bob);
    await bob.post(`/api/projects/${pid}/share`).set('X-CSRF-Token', bobToken).expect(404);
    await bob.get(`/api/projects/${pid}/share`).expect(404);
    const bobDel = await csrf(bob);
    await bob.delete(`/api/projects/${pid}/share`).set('X-CSRF-Token', bobDel).expect(404);
  });

  it('rejects unauthenticated owner status (401)', async () => {
    const alice = await authedAgent();
    const pid = await createProject(alice);
    await request(server()).get(`/api/projects/${pid}/share`).expect(401);
  });
});
