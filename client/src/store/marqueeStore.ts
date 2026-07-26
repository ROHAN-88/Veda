import { create } from 'zustand';
import type { Vec2 } from '../canvas/types';

interface MarqueeState {
  /** The two corners of the selection box, in canvas-local SCREEN px (null = idle). */
  start: Vec2 | null;
  current: Vec2 | null;
  begin: (point: Vec2) => void;
  move: (point: Vec2) => void;
  clear: () => void;
}

/**
 * The in-progress rubber-band selection box (Phase 8). Screen-space so the overlay
 * is a plain rectangle; `useMarquee` converts the corners to world coords for the
 * hit-test.
 */
export const useMarqueeStore = create<MarqueeState>((set) => ({
  start: null,
  current: null,
  begin: (point) => set({ start: point, current: point }),
  move: (point) => set({ current: point }),
  clear: () => set({ start: null, current: null }),
}));
