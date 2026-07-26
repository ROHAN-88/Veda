import { create } from 'zustand';

interface SelectionState {
  /** The currently selected card id, or null. UI-only (never persisted). */
  selectedId: string | null;
  /** The currently selected connection (arrow) id, or null. UI-only. */
  selectedConnectionId: string | null;
  select: (id: string) => void;
  selectConnection: (id: string) => void;
  clear: () => void;
}

/**
 * What is selected on the whiteboard — a card (shows resize/rotate handles +
 * connect ports + the selection toolbar) or a connection arrow (shows the
 * connection toolbar). Card and connection selection are mutually exclusive:
 * selecting one clears the other. A store, not props, because selection is read
 * by several unrelated subtrees (CardView, CardsLayer, ConnectionsLayer, the
 * toolbars) and narrow subscription keeps re-renders minimal.
 */
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedId: null,
  selectedConnectionId: null,
  select: (id) => set({ selectedId: id, selectedConnectionId: null }),
  selectConnection: (id) => set({ selectedConnectionId: id, selectedId: null }),
  clear: () => set({ selectedId: null, selectedConnectionId: null }),
}));
