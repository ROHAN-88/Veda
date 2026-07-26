import { describe, expect, it } from 'vitest';
import { resizeCard, rotateCard } from './cardResize';
import { SIZE_MAX, SIZE_MIN } from './constants';
import type { Vec2 } from './types';

/** World position of a rect corner (sx,sy in {-1,1}) for a rotated card. */
function corner(
  rect: { x: number; y: number; w: number; h: number; rotation: number },
  sx: number,
  sy: number,
): Vec2 {
  const rad = (rect.rotation * Math.PI) / 180;
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const cx = rect.x + hw;
  const cy = rect.y + hh;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: cx + sx * hw * c - sy * hh * s, y: cy + sx * hw * s + sy * hh * c };
}

/** A pointer that should yield `deg` from rotateCard (inverse of its math). */
function pointerAtDeg(deg: number): Vec2 {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: Math.cos(rad) * 100, y: Math.sin(rad) * 100 };
}

describe('resizeCard', () => {
  const base = { x: 0, y: 0, w: 100, h: 100, rotation: 0 };

  it('se handle grows the box, keeping the NW corner fixed (rotation 0)', () => {
    expect(resizeCard(base, 'se', { x: 150, y: 150 })).toEqual({ x: 0, y: 0, w: 150, h: 150 });
  });

  it('nw handle keeps the SE corner fixed (rotation 0)', () => {
    const r = resizeCard(base, 'nw', { x: -20, y: -20 });
    expect(r.x + r.w).toBeCloseTo(100, 6);
    expect(r.y + r.h).toBeCloseTo(100, 6);
    expect(r.w).toBeCloseTo(120, 6);
    expect(r.h).toBeCloseTo(120, 6);
  });

  it('e handle changes width only, keeping the W edge fixed', () => {
    const r = resizeCard(base, 'e', { x: 130, y: 999 });
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.w).toBeCloseTo(130, 6);
    expect(r.h).toBeCloseTo(100, 6);
  });

  it('clamps to SIZE_MIN when dragged past the anchor, corner still fixed', () => {
    const r = resizeCard(base, 'se', { x: -500, y: -500 });
    expect(r.w).toBe(SIZE_MIN);
    expect(r.h).toBe(SIZE_MIN);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(0, 6);
  });

  it('clamps to SIZE_MAX for a huge pointer', () => {
    const r = resizeCard(base, 'se', { x: 1e9, y: 1e9 });
    expect(r.w).toBe(SIZE_MAX);
    expect(r.h).toBe(SIZE_MAX);
  });

  it('keeps the opposite corner world-fixed when rotated 90°', () => {
    const rotated = { x: 0, y: 0, w: 100, h: 100, rotation: 90 };
    const before = corner(rotated, -1, -1); // NW corner (opposite se)
    const r = resizeCard(rotated, 'se', { x: 200, y: 50 });
    const after = corner({ ...r, rotation: 90 }, -1, -1);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
});

describe('rotateCard', () => {
  const c = { x: 0, y: 0 };

  it('measures degrees from up, clockwise positive', () => {
    expect(rotateCard(c, { x: 0, y: -10 })).toBeCloseTo(0, 6); // up
    expect(rotateCard(c, { x: 10, y: 0 })).toBeCloseTo(90, 6); // right
    expect(Math.abs(rotateCard(c, { x: 0, y: 10 }))).toBeCloseTo(180, 6); // down (±180)
    expect(rotateCard(c, { x: -10, y: 0 })).toBeCloseTo(-90, 6); // left
  });

  it('snaps to the nearest 15° when requested', () => {
    expect(rotateCard(c, pointerAtDeg(52), { snap: true })).toBe(45);
    expect(rotateCard(c, pointerAtDeg(53), { snap: true })).toBe(60);
  });
});
