import { create } from 'zustand';

interface PanModeState {
  /** True while Space is held — turns left-drag into a pan instead of a marquee. */
  spaceHeld: boolean;
  setSpaceHeld: (held: boolean) => void;
}

/**
 * Whether Space is held (Phase 8). Left-drag on empty canvas draws a selection
 * marquee; holding Space (or using the middle mouse button) makes it pan instead.
 */
export const usePanModeStore = create<PanModeState>((set) => ({
  spaceHeld: false,
  setSpaceHeld: (held) => set({ spaceHeld: held }),
}));
