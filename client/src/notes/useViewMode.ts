import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseViewMode, VIEW_PARAM, withViewMode, type ViewMode } from './viewMode';

/**
 * The board's current view, read from and written to the URL (`?view=notes`).
 *
 * Setting it PUSHES a history entry rather than replacing one: a view change is
 * visible, so Back should undo it — the mental model everyone has for tabbed views.
 * An unrecognised value reads as the whiteboard and the URL is deliberately left
 * alone; rewriting it would burn a history entry to correct something harmless.
 */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [params, setParams] = useSearchParams();
  const mode = parseViewMode(params.get(VIEW_PARAM));

  const setMode = useCallback(
    (next: ViewMode) => {
      setParams(withViewMode(params, next));
    },
    [params, setParams],
  );

  return [mode, setMode];
}
