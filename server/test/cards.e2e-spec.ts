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

  it('bring-to-front raises a card to the top; zIndex is not client-settable', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const cards = `/api/projects/${projectId}/cards`;

    let token = await csrf(agent);
    const a = await agent.post(cards).set('X-CSRF-Token', token).send({ x: 0, y: 0 }).expect(201);
    token = await csrf(agent);
    const b = await agent.post(cards).set('X-CSRF-Token', token).send({ x: 1, y: 1 }).expect(201);
    expect(a.body.zIndex).toBe(0);
    expect(b.body.zIndex).toBe(1);

    // Raise A above B — the server allocates max+1 (= 2), ignoring any client value.
    token = await csrf(agent);
    const raised = await agent
      .post(`${cards}/${a.body.id}/bring-to-front`)
      .set('X-CSRF-Token', token)
      .expect(200);
    expect(raised.body.zIndex).toBe(2);
    expect(raised.body.zIndex).toBeGreaterThan(b.body.zIndex);

    // zIndex can no longer be set through PATCH (forbidNonWhitelisted → 400).
    token = await csrf(agent);
    await agent
      .patch(`${cards}/${a.body.id}`)
      .set('X-CSRF-Token', token)
      .send({ zIndex: 999 })
      .expect(400);
  });

  it('soft-deletes then restores a card with the same id + zIndex (bulk-restore)', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const cards = `/api/projects/${projectId}/cards`;

    let token = await csrf(agent);
    const created = await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 5, y: 6 })
      .expect(201);
    const id = created.body.id as string;
    const z = created.body.zIndex as number;

    token = await csrf(agent);
    await agent.delete(`${cards}/${id}`).set('X-CSRF-Token', token).expect(204);
    await agent.get(`${cards}/${id}`).expect(404); // gone from single-get
    expect((await agent.get(cards).expect(200)).body).toHaveLength(0); // and from list

    token = await csrf(agent);
    await agent
      .post(`${cards}/bulk-restore`)
      .set('X-CSRF-Token', token)
      .send({ ids: [id] })
      .expect(204);
    const list = await agent.get(cards).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id, zIndex: z }); // same id + stacking
  });

  it('bulk-updates and bulk-deletes many cards; validates the array', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const cards = `/api/projects/${projectId}/cards`;
    const mk = async (): Promise<string> =>
      (
        await agent
          .post(cards)
          .set('X-CSRF-Token', await csrf(agent))
          .send({ x: 0, y: 0 })
          .expect(201)
      ).body.id as string;
    const a = await mk();
    const b = await mk();

    let token = await csrf(agent);
    await agent
      .patch(cards)
      .set('X-CSRF-Token', token)
      .send({
        updates: [
          { id: a, x: 100 },
          { id: b, x: 200 },
        ],
      })
      .expect(200);
    const byId = Object.fromEntries(
      (await agent.get(cards).expect(200)).body.map((c: { id: string; x: number }) => [c.id, c.x]),
    );
    expect(byId[a]).toBe(100);
    expect(byId[b]).toBe(200);

    token = await csrf(agent);
    await agent
      .post(`${cards}/bulk-delete`)
      .set('X-CSRF-Token', token)
      .send({ ids: [a, b] })
      .expect(204);
    expect((await agent.get(cards).expect(200)).body).toHaveLength(0);

    // Validation: empty list + non-UUID id → 400.
    token = await csrf(agent);
    await agent
      .post(`${cards}/bulk-delete`)
      .set('X-CSRF-Token', token)
      .send({ ids: [] })
      .expect(400);
    token = await csrf(agent);
    await agent
      .post(`${cards}/bulk-restore`)
      .set('X-CSRF-Token', token)
      .send({ ids: ['not-a-uuid'] })
      .expect(400);
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
    token = await csrf(bob);
    await bob.post(`${cards}/${id}/bring-to-front`).set('X-CSRF-Token', token).expect(404);
    // Bulk routes verify EACH id is owned — Alice's card id → 404 for Bob.
    token = await csrf(bob);
    await bob
      .patch(cards)
      .set('X-CSRF-Token', token)
      .send({ updates: [{ id, x: 1 }] })
      .expect(404);
    token = await csrf(bob);
    await bob
      .post(`${cards}/bulk-delete`)
      .set('X-CSRF-Token', token)
      .send({ ids: [id] })
      .expect(404);
    token = await csrf(bob);
    await bob
      .post(`${cards}/bulk-restore`)
      .set('X-CSRF-Token', token)
      .send({ ids: [id] })
      .expect(404);

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

  it('persists shape/color/rotation and applies defaults', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const cards = `/api/projects/${projectId}/cards`;

    let token = await csrf(agent);
    const styled = await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 0, y: 0, shape: 'diamond', color: '#ff8800', rotation: 45, fontSize: 28 })
      .expect(201);
    expect(styled.body).toMatchObject({
      shape: 'diamond',
      color: '#ff8800',
      rotation: 45,
      fontSize: 28,
    });

    token = await csrf(agent);
    const plain = await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 1, y: 1 })
      .expect(201);
    expect(plain.body).toMatchObject({
      shape: 'card',
      color: '#ffffff',
      rotation: 0,
      fontSize: 14,
    });

    token = await csrf(agent);
    const patched = await agent
      .patch(`${cards}/${styled.body.id}`)
      .set('X-CSRF-Token', token)
      .send({ shape: 'ellipse', color: '#00ff00', rotation: -90, fontSize: 20 })
      .expect(200);
    expect(patched.body).toMatchObject({
      shape: 'ellipse',
      color: '#00ff00',
      rotation: -90,
      fontSize: 20,
    });
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
    await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 0, y: 0, shape: 'hexagon' })
      .expect(400); // bad shape
    await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 0, y: 0, color: 'red' })
      .expect(400); // bad hex
    await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 0, y: 0, color: '#fff' })
      .expect(400); // 3-digit hex
    await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 0, y: 0, rotation: 720 })
      .expect(400); // rotation OOR
    await agent
      .post(cards)
      .set('X-CSRF-Token', token)
      .send({ x: 0, y: 0, fontSize: 500 })
      .expect(400); // fontSize OOR
    await agent.get('/api/projects/not-a-uuid/cards').expect(400); // non-UUID project id
  });
});
