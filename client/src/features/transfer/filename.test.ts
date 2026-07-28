import { describe, expect, it } from 'vitest';
import { exportFilename } from './filename';

describe('exportFilename', () => {
  it('slugifies a normal name', () => {
    expect(exportFilename('My Board')).toBe('my-board.json');
  });

  it('collapses runs of non-alphanumerics and trims hyphens', () => {
    expect(exportFilename('  Roadmap: Q3 / 2026!! ')).toBe('roadmap-q3-2026.json');
  });

  it('falls back to "board" when nothing usable remains', () => {
    expect(exportFilename('   ')).toBe('board.json');
    expect(exportFilename('***')).toBe('board.json');
  });

  it('bounds the length', () => {
    const long = 'a'.repeat(200);
    const out = exportFilename(long);
    expect(out.endsWith('.json')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(64 + '.json'.length);
  });
});
