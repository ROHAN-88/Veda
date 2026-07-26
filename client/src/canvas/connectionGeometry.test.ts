import { describe, expect, it } from 'vitest';
import { arrowHead, borderPoint, connectionEndpoints } from './connectionGeometry';

// A 100x100 box centred at (cx, cy).
const box = (cx: number, cy: number) => ({ x: cx - 50, y: cy - 50, w: 100, h: 100 });

describe('borderPoint', () => {
  it('exits the right edge toward a point to the east', () => {
    expect(borderPoint(box(0, 0), { x: 500, y: 0 })).toEqual({ x: 50, y: 0 });
  });

  it('exits the top edge toward a point to the north', () => {
    expect(borderPoint(box(0, 0), { x: 0, y: -500 })).toEqual({ x: 0, y: -50 });
  });

  it('exits the corner on a 45° diagonal', () => {
    expect(borderPoint(box(0, 0), { x: 100, y: 100 })).toEqual({ x: 50, y: 50 });
  });

  it('returns the centre when the target coincides with the centre', () => {
    expect(borderPoint(box(10, 20), { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
  });
});

describe('connectionEndpoints', () => {
  it('trims both ends to the card borders along the centre line', () => {
    // Source centred at (200,0), target centred at (0,0).
    const { from, to } = connectionEndpoints(box(200, 0), box(0, 0));
    expect(from).toEqual({ x: 150, y: 0 }); // left edge of source
    expect(to).toEqual({ x: 50, y: 0 }); // right edge of target
  });

  it('falls back to centre-to-centre when the cards overlap', () => {
    const { from, to } = connectionEndpoints(box(0, 0), box(20, 0));
    expect(from).toEqual({ x: 0, y: 0 });
    expect(to).toEqual({ x: 20, y: 0 });
  });
});

describe('arrowHead', () => {
  it('points along the from→tip direction with a base of width `size`', () => {
    const [tip, left, right] = arrowHead({ x: 100, y: 0 }, { x: 0, y: 0 }, 10);
    expect(tip).toEqual({ x: 100, y: 0 });
    // Base sits `size` behind the tip; wings are ±size/2 perpendicular.
    expect(left).toEqual({ x: 90, y: 5 });
    expect(right).toEqual({ x: 90, y: -5 });
  });

  it('collapses to the tip when tip and from coincide', () => {
    const pts = arrowHead({ x: 5, y: 5 }, { x: 5, y: 5 }, 10);
    expect(pts).toEqual([
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ]);
  });
});
