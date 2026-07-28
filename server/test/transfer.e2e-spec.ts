import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

type Agent = ReturnType<typeof request.agent>;
const PASSWORD = 'CorrectHorse9Battery';

describe('Project transfer — export/import (e2e)', () => {
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
    `xfer_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}@example.com`;

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

  async function post(agent: Agent, url: string, body: object, expected = 201) {
    const token = await csrf(agent);
    return (await agent.post(url).set('X-CSRF-Token', token).send(body).expect(expected)).body;
  }

  it('rejects unauthenticated export/import (401)', async () => {
    await request(server())
      .get('/api/projects/00000000-0000-0000-0000-000000000000/export')
      .expect(401);
  });

  it('round-trips a board: export → import creates an identical, owner-scoped copy', async () => {
    const alice = await authedAgent();
    const pid = await createProject(alice, 'Original');

    const a = await post(alice, `/api/projects/${pid}/cards`, {
      x: 10,
      y: 20,
      content: 'Hello',
      color: '#ff0000',
      shape: 'ellipse',
    });
    const b = await post(alice, `/api/projects/${pid}/cards`, { x: 100, y: 200 });
    await post(alice, `/api/projects/${pid}/connections`, {
      sourceCardId: a.id,
      targetCardId: b.id,
      color: '#00ff00',
    });

    const doc = (await alice.get(`/api/projects/${pid}/export`).expect(200)).body;
    expect(doc.version).toBe(1);
    expect(doc.project).toEqual({ name: 'Original' });
    expect(doc.cards).toHaveLength(2);
    expect(doc.cards[0]).toMatchObject({ content: 'Hello', color: '#ff0000', shape: 'ellipse' });
    expect(doc.cards[0]).not.toHaveProperty('id');
    expect(doc.connections).toEqual([
      { sourceRef: doc.cards[0].ref, targetRef: doc.cards[1].ref, color: '#00ff00' },
    ]);

    const imported = await post(alice, '/api/projects/import', doc);
    expect(imported.id).not.toBe(pid);
    expect(imported.name).toBe('Original');

    const cards = (await alice.get(`/api/projects/${imported.id}/cards`).expect(200)).body;
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ content: 'Hello', color: '#ff0000', shape: 'ellipse' });
    expect(cards.map((c: { zIndex: number }) => c.zIndex)).toEqual([0, 1]); // order preserved

    const conns = (await alice.get(`/api/projects/${imported.id}/connections`).expect(200)).body;
    expect(conns).toHaveLength(1);
    expect(conns[0].color).toBe('#00ff00');
    expect(conns[0].sourceCardId).toBe(cards[0].id); // remapped to the NEW ids
    expect(conns[0].targetCardId).toBe(cards[1].id);
  });

  it('validates the import payload (400)', async () => {
    const alice = await authedAgent();
    const base = { version: 1, project: { name: 'X' }, cards: [], connections: [] };
    await post(alice, '/api/projects/import', { ...base, version: 2 }, 400); // wrong version
    await post(alice, '/api/projects/import', { ...base, cards: 'nope' }, 400); // not an array
    await post(alice, '/api/projects/import', { ...base, project: {} }, 400); // missing name
    await post(
      alice,
      '/api/projects/import',
      { ...base, cards: [{ ref: 'a', y: 0 }] }, // card missing required x
      400,
    );
  });

  it('prevents IDOR: user B cannot export user A’s project (404)', async () => {
    const alice = await authedAgent();
    const bob = await authedAgent();
    const pid = await createProject(alice, 'Alice private');
    await bob.get(`/api/projects/${pid}/export`).expect(404);
  });
});
