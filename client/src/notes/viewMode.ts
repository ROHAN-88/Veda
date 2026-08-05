/**
 * Which view of a board is on screen, encoded in the URL as `?view=notes`.
 *
 * The URL is the single source of truth so the choice survives a refresh, works
 * with the Back button, and can be pasted to someone ("here, read it as a list").
 * This module is the ONLY place in the client that parses URL state — keep it that
 * way. Pure: no React, no router, no DOM.
 */
export type ViewMode = 'whiteboard' | 'notes';

export const VIEW_PARAM = 'view';

/**
 * Read the mode from a raw query value. Anything that is not exactly `notes`
 * (case- and space-insensitive) is the whiteboard, so a typo, a stale link, or a
 * hand-edited URL degrades to today's behaviour instead of an error state.
 */
export function parseViewMode(raw: string | null | undefined): ViewMode {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'notes' ? 'notes' : 'whiteboard';
}

/**
 * A NEW params object with the view applied — never mutates the input, which is
 * the live object react-router hands back from `useSearchParams`.
 *
 * The whiteboard is the default, so it is serialised by REMOVING the param rather
 * than writing `?view=whiteboard`: the canonical board URL stays exactly what it
 * is today, and every other param the URL happens to carry is preserved.
 */
export function withViewMode(params: URLSearchParams, mode: ViewMode): URLSearchParams {
  const next = new URLSearchParams(params);
  if (mode === 'notes') {
    next.set(VIEW_PARAM, 'notes');
  } else {
    next.delete(VIEW_PARAM);
  }
  return next;
}
