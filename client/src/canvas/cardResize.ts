/**
 * Pure rotation-aware resize + rotate math for cards (no DOM/React). All geometry
 * is in world space; `rotation` is degrees clockwise about the card centre.
 */
import { SIZE_MAX, SIZE_MIN } from './constants';
import type { Vec2 } from './types';

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface CardRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

interface ResizeOpts {
  minSize?: number;
  maxSize?: number;
}

/** Local-axis sign of each handle: which of ±w / ±h it controls. */
const SIGN: Record<Handle, { sx: -1 | 0 | 1; sy: -1 | 0 | 1 }> = {
  n: { sx: 0, sy: -1 },
  s: { sx: 0, sy: 1 },
  e: { sx: 1, sy: 0 },
  w: { sx: -1, sy: 0 },
  ne: { sx: 1, sy: -1 },
  nw: { sx: -1, sy: -1 },
  se: { sx: 1, sy: 1 },
  sw: { sx: -1, sy: 1 },
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function rotate(v: Vec2, rad: number): Vec2 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * New `{x,y,w,h}` for a resize gesture, keeping the corner/edge OPPOSITE the
 * dragged handle pinned in world space — correct even when the card is rotated.
 * Works in the card's local (unrotated) frame and clamps to [minSize, maxSize].
 */
export function resizeCard(
  card: CardRect,
  handle: Handle,
  worldPointer: Vec2,
  opts: ResizeOpts = {},
): { x: number; y: number; w: number; h: number } {
  const min = opts.minSize ?? SIZE_MIN;
  const max = opts.maxSize ?? SIZE_MAX;
  const rad = (card.rotation * Math.PI) / 180;
  const { sx, sy } = SIGN[handle];
  const hw = card.w / 2;
  const hh = card.h / 2;
  const center = { x: card.x + hw, y: card.y + hh };

  // Anchor = the corner/edge opposite the handle, held fixed in world space.
  const anchorOffset = rotate({ x: -sx * hw, y: -sy * hh }, rad);
  const anchor = { x: center.x + anchorOffset.x, y: center.y + anchorOffset.y };

  // Pointer relative to the anchor, rotated back into the card's local axes.
  const d = rotate({ x: worldPointer.x - anchor.x, y: worldPointer.y - anchor.y }, -rad);
  const w2 = sx !== 0 ? clamp(sx * d.x, min, max) : card.w;
  const h2 = sy !== 0 ? clamp(sy * d.y, min, max) : card.h;

  // New centre so the anchor lands back on the same world point under `rad`.
  const hw2 = w2 / 2;
  const hh2 = h2 / 2;
  const back = rotate({ x: -sx * hw2, y: -sy * hh2 }, rad);
  const center2 = { x: anchor.x - back.x, y: anchor.y - back.y };
  return { x: center2.x - hw2, y: center2.y - hh2, w: w2, h: h2 };
}

/**
 * Rotation in degrees (+clockwise, 0 = handle pointing up) so a rotate handle
 * follows `worldPointer` around `center`. Optionally snaps to the nearest 15°.
 */
export function rotateCard(
  center: Vec2,
  worldPointer: Vec2,
  opts: { snap?: boolean } = {},
): number {
  const dx = worldPointer.x - center.x;
  const dy = worldPointer.y - center.y;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  deg = ((((deg + 180) % 360) + 360) % 360) - 180; // normalize to (-180, 180]
  return opts.snap ? Math.round(deg / 15) * 15 : deg;
}

/** World-space centre of a card. */
export function cardCenter(card: { x: number; y: number; w: number; h: number }): Vec2 {
  return { x: card.x + card.w / 2, y: card.y + card.h / 2 };
}

/** World position of a resize handle on a (possibly rotated) card. */
export function handleWorldPos(card: CardRect, handle: Handle): Vec2 {
  const rad = (card.rotation * Math.PI) / 180;
  const center = cardCenter(card);
  const { sx, sy } = SIGN[handle];
  const off = rotate({ x: sx * (card.w / 2), y: sy * (card.h / 2) }, rad);
  return { x: center.x + off.x, y: center.y + off.y };
}

/** World position of the rotate handle (above the top edge by `offset` world px). */
export function rotateHandleWorldPos(card: CardRect, offset: number): Vec2 {
  const rad = (card.rotation * Math.PI) / 180;
  const center = cardCenter(card);
  const off = rotate({ x: 0, y: -card.h / 2 - offset }, rad);
  return { x: center.x + off.x, y: center.y + off.y };
}
