/**
 * Pure, DOM-free geometry helpers for cards — unit-tested in isolation and reused
 * by the card components so the interaction code stays thin.
 */
import { CELL_SIZE, DEFAULT_CARD_H, DEFAULT_CARD_W } from './constants';
import { screenToWorld } from './coordinates';
import type { Bounds, Camera, Size, Vec2 } from './types';

/** A card's world-space bounding box. */
export function cardBounds(card: { x: number; y: number; w: number; h: number }): Bounds {
  return { x: card.x, y: card.y, w: card.w, h: card.h };
}

/** Apply a SCREEN-space drag delta to a world origin (world delta = screen / zoom). */
export function applyDragDelta(origin: Vec2, screenDelta: Vec2, zoom: number): Vec2 {
  return { x: origin.x + screenDelta.x / zoom, y: origin.y + screenDelta.y / zoom };
}

/** Next stacking index: (max existing) + 1, or 0 for an empty board. */
export function nextZIndex(cards: readonly { zIndex: number }[]): number {
  let max = -1;
  for (const card of cards) {
    if (card.zIndex > max) {
      max = card.zIndex;
    }
  }
  return max + 1;
}

/** The world rect currently visible, expanded by `pad` on every side (for culling). */
export function paddedViewportRect(camera: Camera, size: Size, pad = CELL_SIZE): Bounds {
  const topLeft = screenToWorld(camera, size, { x: 0, y: 0 });
  const bottomRight = screenToWorld(camera, size, { x: size.width, y: size.height });
  return {
    x: topLeft.x - pad,
    y: topLeft.y - pad,
    w: bottomRight.x - topLeft.x + pad * 2,
    h: bottomRight.y - topLeft.y + pad * 2,
  };
}

/** A default-sized card centered on a world point (for click/double-click create). */
export function defaultCardBounds(world: Vec2): Bounds {
  return {
    x: world.x - DEFAULT_CARD_W / 2,
    y: world.y - DEFAULT_CARD_H / 2,
    w: DEFAULT_CARD_W,
    h: DEFAULT_CARD_H,
  };
}
