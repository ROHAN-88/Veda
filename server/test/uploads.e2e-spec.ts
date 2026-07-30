import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

type Agent = ReturnType<typeof request.agent>;
const PASSWORD = 'CorrectHorse9Battery';
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24),
]);

describe('Uploads (e2e)', () => {
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
    `upl_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}@example.com`;

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

  it('uploads an image and serves it publicly by id', async () => {
    const agent = await authedAgent();
    const token = await csrf(agent);
    const created = await agent
      .post('/api/uploads')
      .set('X-CSRF-Token', token)
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(201);
    expect(created.body.mimeType).toBe('image/png');
    expect(created.body.url).toBe(`/api/uploads/${created.body.id}`);

    // Public read — no cookies/session needed (share views load images).
    const got = await request(server()).get(created.body.url).expect(200);
    expect(got.headers['content-type']).toContain('image/png');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects a non-image (415)', async () => {
    const agent = await authedAgent();
    const token = await csrf(agent);
    await agent
      .post('/api/uploads')
      .set('X-CSRF-Token', token)
      .attach('file', Buffer.from('hello world, not an image'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(415);
  });

  it('rejects an oversize file (413)', async () => {
    const agent = await authedAgent();
    const token = await csrf(agent);
    const big = Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]);
    await agent
      .post('/api/uploads')
      .set('X-CSRF-Token', token)
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
      .expect(413);
  });

  it('rejects unauthenticated upload (401)', async () => {
    const anon = request.agent(server());
    const token = await csrf(anon); // anon has a CSRF token but no session
    await anon
      .post('/api/uploads')
      .set('X-CSRF-Token', token)
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      .expect(401);
  });

  it('returns 404 for an unknown upload id', async () => {
    await request(server()).get('/api/uploads/00000000-0000-0000-0000-000000000000').expect(404);
  });
});
