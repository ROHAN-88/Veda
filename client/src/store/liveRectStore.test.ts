import { beforeEach, describe, expect, it } from 'vitest';
import { useLiveRectStore } from './liveRectStore';
import type { CardRect } from '../canvas/cardResize';

const rect = (x: number): CardRect => ({ x, y: 0, w: 10, h: 10, rotation: 0 });

describe('liveRectStore', () => {
  beforeEach(() => useLiveRectStore.setState({ rects: {} }));

  it('sets and clears a live rect by id', () => {
    const { setRect, clearRect } = useLiveRectStore.getState();
    setRect('a', rect(1));
    expect(useLiveRectStore.getState().rects.a).toEqual(rect(1));
    clearRect('a');
    expect(useLiveRectStore.getState().rects.a).toBeUndefined();
  });

  it('keeps untouched ids referentially stable when one changes', () => {
    const { setRect } = useLiveRectStore.getState();
    setRect('a', rect(1));
    const aBefore = useLiveRectStore.getState().rects.a;
    setRect('b', rect(2));
    // 'a' must be the SAME object so its subscribers don't re-render.
    expect(useLiveRectStore.getState().rects.a).toBe(aBefore);
  });

  it('clearRect on an absent id does not churn the object reference', () => {
    const { setRect, clearRect } = useLiveRectStore.getState();
    setRect('a', rect(1));
    const before = useLiveRectStore.getState().rects;
    clearRect('missing');
    expect(useLiveRectStore.getState().rects).toBe(before);
  });
});
