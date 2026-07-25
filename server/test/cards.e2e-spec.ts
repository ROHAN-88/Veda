import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

type Agent = ReturnType<typeof request.agent>;
const PASSWORD = 'CorrectHorse9Battery';

describe('Cards (e2e)', () => {
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
    `card_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}@example.com`;

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

  it('rejects unauthenticated access (401)', async () => {
    // Valid UUID so the guard (not the UUID pipe) is what rejects.
    await request(server())
      .get('/api/projects/11111111-1111-1111-1111-111111111111/cards')
      .expect(401);
  });

  it('supports full CRUD with server-assigned zIndex', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const cards = `/api/projects/${projectId}/cards`;

    let token = await csrf(agent);
    const first = await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 10, y: 20, content: '  hello  ' })
      .expect(201);
    expect(first.body.zIndex).toBe(0);
    expect(first.body.content).toBe('hello'); // trimmed
    expect(first.body.w).toBe(240); // schema default applied
    const id = first.body.id as string;

    token = await csrf(agent);
    const second = await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 0, y: 0 })
      .expect(201);
    expect(second.body.zIndex).toBe(1); // max+1

    const list = await agent.get(cards).expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body.map((c: { zIndex: number }) => c.zIndex)).toEqual([0, 1]); // ordered asc

    await agent.get(`${cards}/${id}`).expect(200);

    token = await csrf(agent);
    const patched = await agent
      .patch(`${cards}/${id}`)
      .set('X-CSRF-Token', token)
      .send({ x: 99, y: 88, content: 'edited' })
      .expect(200);
    expect(patched.body.x).toBe(99);
    expect(patched.body.content).toBe('edited');

    token = await csrf(agent);
    await agent.delete(`${cards}/${id}`).set('X-CSRF-Token', token).expect(204);
    await agent.get(`${cards}/${id}`).expect(404);
  });

  it('prevents cross-user IDOR: user B cannot touch user A cards (404)', async () => {
    const alice = await authedAgent();
    const bob = await authedAgent();
    const projectId = await createProject(alice, 'Alice board');
    const cards = `/api/projects/${projectId}/cards`;

    let token = await csrf(alice);
    const created = await alice
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 1, y: 2, content: 'secret' })
      .expect(201);
    const id = created.body.id as string;

    await bob.get(cards).expect(404);
    await bob.get(`${cards}/${id}`).expect(404);
    token = await csrf(bob);
    await bob.patch(`${cards}/${id}`).set('X-CSRF-Token', token).send({ x: 5 }).expect(404);
    token = await csrf(bob);
    await bob.delete(`${cards}/${id}`).set('X-CSRF-Token', token).expect(404);
    token = await csrf(bob);
    await bob.post(cards).set('X-CSRF-Token', token).send({ x: 0, y: 0 }).expect(404);

    const still = await alice.get(`${cards}/${id}`).expect(200);
    expect(still.body.content).toBe('secret');
  });

  it('prevents cross-project IDOR: a card is 404 under a different project (404)', async () => {
    const alice = await authedAgent();
    const projectA = await createProject(alice, 'A');
    const projectB = await createProject(alice, 'B');

    let token = await csrf(alice);
    const created = await alice
      .post(`/api/projects/${projectA}/cards`)
      .set('X-CSRF-Token', token)
      .send({ x: 1, y: 1 })
      .expect(201);
    const id = created.body.id as string;

    // Same owner, wrong project id in the URL → the card is not in project B.
    await alice.get(`/api/projects/${projectB}/cards/${id}`).expect(404);
    token = await csrf(alice);
    await alice
      .patch(`/api/projects/${projectB}/cards/${id}`)
      .set('X-CSRF-Token', token)
      .send({ x: 9 })
      .expect(404);
    token = await csrf(alice);
    await alice
      .delete(`/api/projects/${projectB}/cards/${id}`)
      .set('X-CSRF-Token', token)
      .expect(404);

    // Still reachable under its real project.
    await alice.get(`/api/projects/${projectA}/cards/${id}`).expect(200);
  });

  it('validates card input (400)', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const cards = `/api/projects/${projectId}/cards`;
    const token = await csrf(agent);

    await agent.post(cards).set('X-CSRF-Token', token).send({ y: 0 }).expect(400); // missing x
    await agent.post(cards).set('X-CSRF-Token', token).send({ x: 9e9, y: 0 }).expect(400); // x out of bounds
    await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 0, y: 0, content: 'a'.repeat(10_001) })
      .expect(400); // content too long
    await agent.post(cards).set('X-CSRF-Token', token).send({ x: 0, y: 0, w: 10 }).expect(400); // w below min
    await agent.get('/api/projects/not-a-uuid/cards').expect(400); // non-UUID project id
  });
});
