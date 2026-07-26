import { NUDGE_STEP, NUDGE_STEP_LARGE } from './constants';
import type { Vec2 } from './types';

/**
 * Map an arrow key to a world-space nudge delta for the selected card, or `null`
 * for any non-arrow key. `Shift` uses the larger step. Pure — unit-tested.
 */
export function nudgeDelta(key: string, shift: boolean): Vec2 | null {
  const step = shift ? NUDGE_STEP_LARGE : NUDGE_STEP;
  switch (key) {
    case 'ArrowLeft':
      return { x: -step, y: 0 };
    case 'ArrowRight':
      return { x: step, y: 0 };
    case 'ArrowUp':
      return { x: 0, y: -step };
    case 'ArrowDown':
      return { x: 0, y: step };
    default:
      return null;
  }
}
