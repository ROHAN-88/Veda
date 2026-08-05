import { HealthController } from './health.controller';

describe('HealthController', () => {
  const controller = new HealthController();
  const original = process.env.BUILD_SHA;

  // The env var is process-global — restore it so these cases stay independent
  // and cannot leak a fake sha into any other suite.
  afterEach(() => {
    if (original === undefined) {
      delete process.env.BUILD_SHA;
    } else {
      process.env.BUILD_SHA = original;
    }
  });

  it('reports ok with a non-negative uptime', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('reports the build baked in at image build time', () => {
    process.env.BUILD_SHA = '32c7ed2';
    expect(controller.check().build).toBe('32c7ed2');
  });

  // A local `node dist/main.js` run has no BUILD_SHA and must still work — the
  // build identifier is diagnostic, never a boot requirement.
  it('falls back to dev when BUILD_SHA is unset', () => {
    delete process.env.BUILD_SHA;
    expect(controller.check().build).toBe('dev');
  });

  // `--build-arg GIT_SHA=` yields an empty string, which is not a usable answer
  // to "which build is this?" — it must degrade to the same fallback.
  it('falls back to dev when BUILD_SHA is empty', () => {
    process.env.BUILD_SHA = '';
    expect(controller.check().build).toBe('dev');
  });

  it('exposes nothing beyond status, uptime and build', () => {
    expect(Object.keys(controller.check()).sort()).toEqual(['build', 'status', 'uptime']);
  });
});
