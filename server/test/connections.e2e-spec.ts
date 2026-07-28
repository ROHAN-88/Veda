import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

type Agent = ReturnType<typeof request.agent>;
const PASSWORD = 'CorrectHorse9Battery';

describe('Connections (e2e)', () => {
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
    `conn_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}@example.com`;

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

  async function createCard(agent: Agent, projectId: string, x = 0, y = 0): Promise<string> {
    const token = await csrf(agent);
    const res = await agent
      .post(`/api/projects/${projectId}/cards`)
      .set('X-CSRF-Token', token)
      .send({ x, y })
      .expect(201);
    return res.body.id as string;
  }

  it('rejects unauthenticated access (401)', async () => {
    await request(server())
      .get('/api/projects/11111111-1111-1111-1111-111111111111/connections')
      .expect(401);
  });

  it('supports create → list → recolor → delete', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const a = await createCard(agent, projectId, 0, 0);
    const b = await createCard(agent, projectId, 400, 0);
    const connections = `/api/projects/${projectId}/connections`;

    let token = await csrf(agent);
    const created = await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b })
      .expect(201);
    expect(created.body).toMatchObject({ sourceCardId: a, targetCardId: b, color: '#64748b' });
    const id = created.body.id as string;

    const list = await agent.get(connections).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(id);

    token = await csrf(agent);
    const patched = await agent
      .patch(`${connections}/${id}`)
      .set('X-CSRF-Token', token)
      .send({ color: '#ff0000' })
      .expect(200);
    expect(patched.body.color).toBe('#ff0000');

    token = await csrf(agent);
    await agent.delete(`${connections}/${id}`).set('X-CSRF-Token', token).expect(204);
    await agent.get(`${connections}/${id}`).expect(404);
  });

  it('sets and validates the midpoint label', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const a = await createCard(agent, projectId, 0, 0);
    const b = await createCard(agent, projectId, 400, 0);
    const connections = `/api/projects/${projectId}/connections`;

    let token = await csrf(agent);
    const created = await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b })
      .expect(201);
    expect(created.body.label).toBe(''); // schema default
    const id = created.body.id as string;

    token = await csrf(agent);
    const patched = await agent
      .patch(`${connections}/${id}`)
      .set('X-CSRF-Token', token)
      .send({ label: '  depends on  ' })
      .expect(200);
    expect(patched.body.label).toBe('depends on'); // trimmed

    const list = await agent.get(connections).expect(200);
    expect(list.body[0].label).toBe('depends on');

    token = await csrf(agent);
    await agent
      .patch(`${connections}/${id}`)
      .set('X-CSRF-Token', token)
      .send({ label: 'x'.repeat(201) })
      .expect(400); // over LABEL_MAX
  });

  it('prevents cross-user IDOR: user B cannot touch user A connections (404)', async () => {
    const alice = await authedAgent();
    const bob = await authedAgent();
    const projectId = await createProject(alice, 'Alice board');
    const a = await createCard(alice, projectId, 0, 0);
    const b = await createCard(alice, projectId, 400, 0);
    const connections = `/api/projects/${projectId}/connections`;

    let token = await csrf(alice);
    const created = await alice
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b })
      .expect(201);
    const id = created.body.id as string;

    await bob.get(connections).expect(404);
    await bob.get(`${connections}/${id}`).expect(404);
    token = await csrf(bob);
    await bob
      .patch(`${connections}/${id}`)
      .set('X-CSRF-Token', token)
      .send({ color: '#000000' })
      .expect(404);
    token = await csrf(bob);
    await bob.delete(`${connections}/${id}`).set('X-CSRF-Token', token).expect(404);
    token = await csrf(bob);
    await bob
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b })
      .expect(404);

    // Still intact for Alice.
    await alice.get(`${connections}/${id}`).expect(200);
  });

  it('prevents linking a card from another project (404)', async () => {
    const alice = await authedAgent();
    const projectA = await createProject(alice, 'A');
    const projectB = await createProject(alice, 'B');
    const cardA = await createCard(alice, projectA, 0, 0);
    const cardB = await createCard(alice, projectB, 0, 0);

    // Same owner, but cardB is not in projectA → 404 (per-project guard).
    const token = await csrf(alice);
    await alice
      .post(`/api/projects/${projectA}/connections`)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: cardA, targetCardId: cardB })
      .expect(404);
  });

  it('rejects a self-connection (400) and a duplicate (409)', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const a = await createCard(agent, projectId, 0, 0);
    const b = await createCard(agent, projectId, 400, 0);
    const connections = `/api/projects/${projectId}/connections`;

    let token = await csrf(agent);
    await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: a })
      .expect(400); // self-connection

    token = await csrf(agent);
    await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b })
      .expect(201);

    token = await csrf(agent);
    await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b })
      .expect(409); // duplicate ordered pair
  });

  it('cascades: deleting a card removes its connections', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const a = await createCard(agent, projectId, 0, 0);
    const b = await createCard(agent, projectId, 400, 0);
    const connections = `/api/projects/${projectId}/connections`;

    let token = await csrf(agent);
    await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b })
      .expect(201);
    expect((await agent.get(connections).expect(200)).body).toHaveLength(1);

    token = await csrf(agent);
    await agent
      .delete(`/api/projects/${projectId}/cards/${a}`)
      .set('X-CSRF-Token', token)
      .expect(204);

    expect((await agent.get(connections).expect(200)).body).toHaveLength(0);
  });

  it('soft-deletes an arrow; re-creating the pair restores the same row', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const a = await createCard(agent, projectId, 0, 0);
    const b = await createCard(agent, projectId, 400, 0);
    const connections = `/api/projects/${projectId}/connections`;

    let token = await csrf(agent);
    const created = await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b })
      .expect(201);
    const id = created.body.id as string;

    token = await csrf(agent);
    await agent.delete(`${connections}/${id}`).set('X-CSRF-Token', token).expect(204);
    expect((await agent.get(connections).expect(200)).body).toHaveLength(0);

    // Re-creating the same ordered pair restores the soft-deleted row (same id).
    token = await csrf(agent);
    const recreated = await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b, color: '#123456' })
      .expect(201);
    expect(recreated.body.id).toBe(id);
    expect(recreated.body.color).toBe('#123456');
    expect((await agent.get(connections).expect(200)).body).toHaveLength(1);
  });

  it('restoring a soft-deleted card brings its arrows back', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const a = await createCard(agent, projectId, 0, 0);
    const b = await createCard(agent, projectId, 400, 0);
    const cards = `/api/projects/${projectId}/cards`;
    const connections = `/api/projects/${projectId}/connections`;

    let token = await csrf(agent);
    await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b })
      .expect(201);

    token = await csrf(agent);
    await agent.delete(`${cards}/${a}`).set('X-CSRF-Token', token).expect(204); // soft-delete card
    expect((await agent.get(connections).expect(200)).body).toHaveLength(0); // arrow hidden

    token = await csrf(agent);
    await agent
      .post(`${cards}/bulk-restore`)
      .set('X-CSRF-Token', token)
      .send({ ids: [a] })
      .expect(204);
    expect((await agent.get(connections).expect(200)).body).toHaveLength(1); // arrow back
  });

  it('validates connection input (400)', async () => {
    const agent = await authedAgent();
    const projectId = await createProject(agent);
    const a = await createCard(agent, projectId, 0, 0);
    const b = await createCard(agent, projectId, 400, 0);
    const connections = `/api/projects/${projectId}/connections`;
    const token = await csrf(agent);

    await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: 'not-a-uuid', targetCardId: b })
      .expect(400); // bad source UUID
    await agent.post(connections).set('X-CSRF-Token', token).send({ sourceCardId: a }).expect(400); // missing target
    await agent
      .post(connections)
      .set('X-CSRF-Token', token)
      .send({ sourceCardId: a, targetCardId: b, color: 'red' })
      .expect(400); // bad hex
    await agent.get('/api/projects/not-a-uuid/connections').expect(400); // non-UUID project id
  });
});
