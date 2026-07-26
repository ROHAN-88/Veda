import { describe, expect, it } from 'vitest';
import { cardsInRect, rectFromCorners } from './cardsInRect';
import type { Card } from '../api/types';

const card = (id: string, x: number, y: number, w = 100, h = 100): Card =>
  ({ id, x, y, w, h }) as Card;

describe('rectFromCorners', () => {
  it('normalises corners regardless of order', () => {
    expect(rectFromCorners({ x: 30, y: 40 }, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
      w: 20,
      h: 20,
    });
  });
});

describe('cardsInRect', () => {
  const cards = [card('a', 0, 0), card('b', 200, 0), card('c', 0, 200)];

  it('selects only the cards whose bounds intersect the rect', () => {
    expect(cardsInRect(cards, { x: -10, y: -10, w: 60, h: 60 })).toEqual(['a']);
  });

  it('selects several on a wide overlap', () => {
    expect(cardsInRect(cards, { x: -10, y: -10, w: 400, h: 20 }).sort()).toEqual(['a', 'b']);
  });

  it('selects nothing when the rect misses every card', () => {
    expect(cardsInRect(cards, { x: 500, y: 500, w: 10, h: 10 })).toEqual([]);
  });
});
