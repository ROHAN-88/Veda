import { cardBounds } from './cardGeometry';
import type { Bounds, Vec2 } from './types';
import type { Card } from '../api/types';

/** Normalise two world-space corners into a positive-extent rect. */
export function rectFromCorners(a: Vec2, b: Vec2): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

/**
 * Ids of the cards whose axis-aligned bounds INTERSECT the world rect (rotation
 * ignored, matching `cardBounds` and the culling grid). Touch-to-select. Pure —
 * used by the marquee hit-test and unit-tested.
 */
export function cardsInRect(cards: Card[], rect: Bounds): string[] {
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  return cards
    .filter((card) => {
      const b = cardBounds(card);
      return b.x < right && b.x + b.w > rect.x && b.y < bottom && b.y + b.h > rect.y;
    })
    .map((card) => card.id);
}
