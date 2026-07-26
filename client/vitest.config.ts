import { defineConfig } from 'vitest/config';

/**
 * Unit tests cover the pure DSA logic (coordinate transforms, spatial grid,
 * viewport store). They touch no DOM, so the lightweight `node` environment is
 * used deliberately — no jsdom/happy-dom dependency is pulled in.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // `.tsx` is included for render-based security tests that use
    // `react-dom/server`'s `renderToStaticMarkup` — it needs no DOM, so the
    // lightweight `node` environment still applies.
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
