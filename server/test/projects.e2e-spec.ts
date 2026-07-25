import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

type Agent = ReturnType<typeof request.agent>;
const PASSWORD = 'CorrectHorse9Battery';

describe('Projects (e2e)', () => {
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
    `proj_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}@example.com`;

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

  it('rejects unauthenticated access (401)', async () => {
    await request(server()).get('/api/projects').expect(401);
  });

  it('supports full CRUD scoped to the owner', async () => {
    const agent = await authedAgent();

    let token = await csrf(agent);
    const created = await agent
      .post('/api/projects')
      .set('X-CSRF-Token', token)
      .send({ name: '  My Board  ' })
      .expect(201);
    expect(created.body.name).toBe('My Board'); // trimmed
    const id = created.body.id as string;

    const list = await agent.get('/api/projects').expect(200);
    expect(list.body.some((p: { id: string }) => p.id === id)).toBe(true);

    await agent.get(`/api/projects/${id}`).expect(200);

    token = await csrf(agent);
    const renamed = await agent
      .patch(`/api/projects/${id}`)
      .set('X-CSRF-Token', token)
      .send({ name: 'Renamed' })
      .expect(200);
    expect(renamed.body.name).toBe('Renamed');

    token = await csrf(agent);
    await agent.delete(`/api/projects/${id}`).set('X-CSRF-Token', token).expect(204);
    await agent.get(`/api/projects/${id}`).expect(404);
  });

  it('prevents IDOR: user B cannot read/update/delete user A projects (404)', async () => {
    const alice = await authedAgent();
    const bob = await authedAgent();

    let token = await csrf(alice);
    const created = await alice
      .post('/api/projects')
      .set('X-CSRF-Token', token)
      .send({ name: 'Alice private' })
      .expect(201);
    const id = created.body.id as string;

    const bobList = await bob.get('/api/projects').expect(200);
    expect(bobList.body.some((p: { id: string }) => p.id === id)).toBe(false);
    await bob.get(`/api/projects/${id}`).expect(404);

    token = await csrf(bob);
    await bob
      .patch(`/api/projects/${id}`)
      .set('X-CSRF-Token', token)
      .send({ name: 'hacked' })
      .expect(404);
    token = await csrf(bob);
    await bob.delete(`/api/projects/${id}`).set('X-CSRF-Token', token).expect(404);

    // Alice's project is untouched.
    const stillThere = await alice.get(`/api/projects/${id}`).expect(200);
    expect(stillThere.body.name).toBe('Alice private');
  });

  it('validates the project name (400)', async () => {
    const agent = await authedAgent();
    const token = await csrf(agent);
    await agent.post('/api/projects').set('X-CSRF-Token', token).send({ name: '' }).expect(400);
  });
});
