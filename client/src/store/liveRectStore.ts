import { create } from 'zustand';
import type { CardRect } from '../canvas/cardResize';

interface LiveRectState {
  /** Live (mid-gesture) geometry keyed by card id. Empty when nothing moves. */
  rects: Record<string, CardRect>;
  setRect: (id: string, rect: CardRect) => void;
  clearRect: (id: string) => void;
}

/**
 * The live position/size/rotation of cards currently being dragged, resized, or
 * rotated. `CardView` writes here for the duration of a gesture and clears on
 * release, so the arrow layer (`ConnectionsLayer`) can re-anchor connections to a
 * card *while* it moves — the committed React Query cache only updates on gesture
 * end. `setRect`/`clearRect` build a fresh `rects` object but leave untouched ids
 * referentially stable, so unaffected subscribers don't re-render.
 */
export const useLiveRectStore = create<LiveRectState>((set) => ({
  rects: {},
  setRect: (id, rect) => set((state) => ({ rects: { ...state.rects, [id]: rect } })),
  clearRect: (id) =>
    set((state) => {
      if (!(id in state.rects)) {
        return state; // no-op: don't churn the object reference
      }
      const next = { ...state.rects };
      delete next[id];
      return { rects: next };
    }),
}));

/**
 * Subscribe to just ONE card's live rect. A component using this re-renders only
 * when that card's rect changes — so an arrow following card A ignores a drag of
 * unrelated card B (the whole-`rects` subscription would re-render on every drag).
 */
export const useLiveRect = (id: string): CardRect | undefined =>
  useLiveRectStore((state) => state.rects[id]);
