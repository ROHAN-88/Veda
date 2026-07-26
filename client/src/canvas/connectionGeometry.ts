/**
 * Pure geometry for relation arrows (no DOM/React). Endpoints are trimmed to each
 * card's axis-aligned bounding box (rotation ignored, matching `cardBounds`) so
 * the arrow touches the card border rather than disappearing under it. The
 * arrowhead is built in screen space so it stays a constant pixel size at any zoom.
 */
import { cardCenter } from './cardResize';
import type { Vec2 } from './types';

/** Just the box a connection anchors to; rotation is intentionally not used. */
export interface AnchorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The point on the border of `rect` (centred at `C`) along the ray from `C`
 * toward `toward`. `C` is inside the box, so the ray always exits at one side.
 * Returns the centre when `toward` coincides with the centre.
 */
export function borderPoint(rect: AnchorRect, toward: Vec2): Vec2 {
  const c = cardCenter(rect);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) {
    return c;
  }
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

/**
 * Both endpoints of an arrow `source -> target`, each trimmed to its card border
 * along the centre-to-centre line. When the cards overlap so heavily that the
 * trimmed segment would point backwards, fall back to centre-to-centre.
 */
export function connectionEndpoints(
  source: AnchorRect,
  target: AnchorRect,
): { from: Vec2; to: Vec2 } {
  const cs = cardCenter(source);
  const ct = cardCenter(target);
  const from = borderPoint(source, ct);
  const to = borderPoint(target, cs);
  // Overlap guard: if the border points reverse the intended direction, the cards
  // overlap — draw centre-to-centre instead of an inverted stub.
  const forward = (ct.x - cs.x) * (to.x - from.x) + (ct.y - cs.y) * (to.y - from.y);
  if (forward <= 0) {
    return { from: cs, to: ct };
  }
  return { from, to };
}

/**
 * Triangle points for an arrowhead whose tip sits at `tip`, pointing away from
 * `from`, with the given base length/width `size` (screen px). Degenerate input
 * (tip === from) collapses to the tip.
 */
export function arrowHead(tip: Vec2, from: Vec2, size: number): Vec2[] {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) {
    return [tip, tip, tip];
  }
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy; // unit perpendicular
  const py = ux;
  const baseX = tip.x - ux * size;
  const baseY = tip.y - uy * size;
  const half = size / 2;
  return [
    tip,
    { x: baseX + px * half, y: baseY + py * half },
    { x: baseX - px * half, y: baseY - py * half },
  ];
}

/** Serialise polygon points to an SVG `points` attribute value. */
export function toPointsAttr(points: Vec2[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ');
}
