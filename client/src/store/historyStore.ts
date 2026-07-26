import { create } from 'zustand';

/**
 * One reversible user action. `undo`/`redo` are closures captured at the action
 * site (they call the bulk mutation hooks directly) so replaying them never
 * re-pushes onto the stack.
 */
export interface Command {
  undo: () => void;
  redo: () => void;
  label?: string;
}

interface HistoryState {
  past: Command[];
  future: Command[];
  /** Record a just-performed action; clears the redo stack. */
  push: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
  /** Drop all history (e.g. when switching projects). */
  clear: () => void;
}

/** Cap the stack so a long session can't grow it unbounded. */
const CAP = 100;

/**
 * Session-scoped undo/redo command stack (Phase 8). No server history exists, so
 * each action pushes inverse-op closures here; Ctrl/⌘-Z pops `past`, Ctrl/⌘-Y (or
 * ⇧-Z) pops `future`. Not persisted across reloads.
 */
export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  push: (cmd) => set((state) => ({ past: [...state.past, cmd].slice(-CAP), future: [] })),
  undo: () => {
    const cmd = get().past.at(-1);
    if (!cmd) {
      return;
    }
    cmd.undo();
    set((state) => ({
      past: state.past.slice(0, -1),
      future: [...state.future, cmd].slice(-CAP),
    }));
  },
  redo: () => {
    const cmd = get().future.at(-1);
    if (!cmd) {
      return;
    }
    cmd.redo();
    set((state) => ({
      future: state.future.slice(0, -1),
      past: [...state.past, cmd].slice(-CAP),
    }));
  },
  clear: () => set({ past: [], future: [] }),
}));
