import { describe, expect, it } from 'vitest';
import {
  applyDragDelta,
  cardBounds,
  defaultCardBounds,
  nextZIndex,
  paddedViewportRect,
} from './cardGeometry';
import { CELL_SIZE, DEFAULT_CARD_H, DEFAULT_CARD_W } from './constants';
import type { Camera, Size } from './types';

const SIZE: Size = { width: 800, height: 600 };

describe('cardGeometry', () => {
  it('cardBounds maps fields 1:1', () => {
    expect(cardBounds({ x: 1, y: 2, w: 3, h: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it('applyDragDelta converts a screen delta to a world delta by zoom', () => {
    expect(applyDragDelta({ x: 10, y: 10 }, { x: 20, y: -8 }, 1)).toEqual({ x: 30, y: 2 });
    expect(applyDragDelta({ x: 0, y: 0 }, { x: 20, y: 20 }, 2)).toEqual({ x: 10, y: 10 });
    expect(applyDragDelta({ x: 0, y: 0 }, { x: 5, y: 5 }, 0.5)).toEqual({ x: 10, y: 10 });
  });

  it('nextZIndex returns max+1 (0 for empty), regardless of order', () => {
    expect(nextZIndex([])).toBe(0);
    expect(nextZIndex([{ zIndex: 0 }, { zIndex: 1 }, { zIndex: 5 }])).toBe(6);
    expect(nextZIndex([{ zIndex: 5 }, { zIndex: 2 }, { zIndex: 4 }])).toBe(6);
    expect(nextZIndex([{ zIndex: 3 }])).toBe(4);
  });

  it('paddedViewportRect covers the viewport expanded by pad on each side', () => {
    const camera: Camera = { center: { x: 0, y: 0 }, zoom: 1 };
    const rect = paddedViewportRect(camera, SIZE, CELL_SIZE);
    // viewport world span is [-400,400] x [-300,300]; padded by CELL_SIZE
    expect(rect.x).toBeCloseTo(-400 - CELL_SIZE, 6);
    expect(rect.y).toBeCloseTo(-300 - CELL_SIZE, 6);
    expect(rect.w).toBeCloseTo(800 + CELL_SIZE * 2, 6);
    expect(rect.h).toBeCloseTo(600 + CELL_SIZE * 2, 6);
  });

  it('paddedViewportRect includes a point just off-screen but within pad', () => {
    const camera: Camera = { center: { x: 0, y: 0 }, zoom: 1 };
    const rect = paddedViewportRect(camera, SIZE, CELL_SIZE);
    const justOff = { x: 420, y: 0 }; // 20px past the right edge, within CELL_SIZE pad
    expect(justOff.x >= rect.x && justOff.x <= rect.x + rect.w).toBe(true);
  });

  it('paddedViewportRect halves the world span at 2x zoom', () => {
    const camera: Camera = { center: { x: 0, y: 0 }, zoom: 2 };
    const rect = paddedViewportRect(camera, SIZE, 0);
    expect(rect.w).toBeCloseTo(400, 6); // 800 screen px / 2
    expect(rect.h).toBeCloseTo(300, 6);
  });

  it('defaultCardBounds centers a default-sized card on the world point', () => {
    expect(defaultCardBounds({ x: 100, y: 50 })).toEqual({
      x: 100 - DEFAULT_CARD_W / 2,
      y: 50 - DEFAULT_CARD_H / 2,
      w: DEFAULT_CARD_W,
      h: DEFAULT_CARD_H,
    });
  });
});
