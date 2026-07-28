import { create } from 'zustand';

/** The active canvas tool: interact with cards, or pan the board. */
export type Tool = 'select' | 'pan';

interface ToolState {
  tool: Tool;
  setTool: (tool: Tool) => void;
}

/**
 * Which tool a left-drag drives (replaces the old implicit rule + Space/middle pan).
 * `select` (default) = click/drag/marquee cards, edit, connect; `pan` = the hand
 * tool — left-drag anywhere pans the board and cards are inert. The read-only
 * shared view is treated as `pan` regardless of this value.
 */
export const useToolStore = create<ToolState>((set) => ({
  tool: 'select',
  setTool: (tool) => set({ tool }),
}));
