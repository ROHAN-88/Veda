import { create } from 'zustand';
import type { Vec2 } from '../canvas/types';

interface ConnectionDraftState {
  /** The source card a connection is being dragged FROM, or null when idle. */
  sourceId: string | null;
  /** Current pointer position in world space while dragging the draft arrow. */
  cursor: Vec2 | null;
  begin: (sourceId: string, cursor: Vec2) => void;
  move: (cursor: Vec2) => void;
  clear: () => void;
}

/**
 * The in-progress "draft" connection while the user drags from a card's connect
 * port. `sourceId` is set on port pointer-down; `cursor` tracks the pointer (world
 * space) so the rubber-band line in `ConnectionsLayer` can follow it. Cleared on
 * drop/cancel. A store because the port (deep in `CardHandles`) and the arrow
 * layer are unrelated subtrees.
 */
export const useConnectionDraftStore = create<ConnectionDraftState>((set) => ({
  sourceId: null,
  cursor: null,
  begin: (sourceId, cursor) => set({ sourceId, cursor }),
  move: (cursor) => set({ cursor }),
  clear: () => set({ sourceId: null, cursor: null }),
}));
