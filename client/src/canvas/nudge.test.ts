import { describe, expect, it } from 'vitest';
import { NUDGE_STEP, NUDGE_STEP_LARGE } from './constants';
import { nudgeDelta } from './nudge';

describe('nudgeDelta', () => {
  it('maps each arrow to a one-step delta', () => {
    expect(nudgeDelta('ArrowLeft', false)).toEqual({ x: -NUDGE_STEP, y: 0 });
    expect(nudgeDelta('ArrowRight', false)).toEqual({ x: NUDGE_STEP, y: 0 });
    expect(nudgeDelta('ArrowUp', false)).toEqual({ x: 0, y: -NUDGE_STEP });
    expect(nudgeDelta('ArrowDown', false)).toEqual({ x: 0, y: NUDGE_STEP });
  });

  it('uses the large step with Shift held', () => {
    expect(nudgeDelta('ArrowRight', true)).toEqual({ x: NUDGE_STEP_LARGE, y: 0 });
    expect(nudgeDelta('ArrowUp', true)).toEqual({ x: 0, y: -NUDGE_STEP_LARGE });
  });

  it('returns null for non-arrow keys', () => {
    expect(nudgeDelta('a', false)).toBeNull();
    expect(nudgeDelta('Enter', true)).toBeNull();
    expect(nudgeDelta('Delete', false)).toBeNull();
  });
});
