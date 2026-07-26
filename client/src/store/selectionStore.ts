import { create } from 'zustand';

interface SelectionState {
  /** Selected card ids (multi-select). UI-only, never persisted. */
  selectedIds: Set<string>;
  /** The selected connection (arrow) id, or null. Arrows stay single-select. */
  selectedConnectionId: string | null;
  /** Replace the card selection with just this id. */
  select: (id: string) => void;
  /** Add/remove one id (Shift-click). */
  toggle: (id: string) => void;
  /** Replace the card selection with these ids (marquee / select-all). */
  selectMany: (ids: string[]) => void;
  /** Union these ids into the selection (Shift + marquee). */
  addMany: (ids: string[]) => void;
  /** Select a single connection (clears card selection). */
  selectConnection: (id: string) => void;
  clear: () => void;
}

/**
 * What is selected on the whiteboard — a SET of cards (Phase 8 multi-select; shows
 * handles/ports on each and the group toolbar) or a single connection arrow. Card
 * and connection selection are mutually exclusive: selecting one clears the other.
 * A store, not props, because selection is read by several unrelated subtrees and
 * narrow subscription keeps re-renders minimal.
 */
export const useSelectionStore = create<SelectionState>((set) => ({
  selectedIds: new Set<string>(),
  selectedConnectionId: null,
  select: (id) => set({ selectedIds: new Set([id]), selectedConnectionId: null }),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next, selectedConnectionId: null };
    }),
  selectMany: (ids) => set({ selectedIds: new Set(ids), selectedConnectionId: null }),
  addMany: (ids) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      for (const id of ids) {
        next.add(id);
      }
      return { selectedIds: next, selectedConnectionId: null };
    }),
  selectConnection: (id) => set({ selectedConnectionId: id, selectedIds: new Set<string>() }),
  clear: () => set({ selectedIds: new Set<string>(), selectedConnectionId: null }),
}));
