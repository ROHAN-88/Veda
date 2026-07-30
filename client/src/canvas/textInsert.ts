/**
 * Insert `snippet` into `value`, replacing the `[start, end)` selection. Returns
 * the new string and the caret offset just after the inserted text. Pure — the
 * card editor uses it to drop media Markdown at the cursor.
 */
export function insertAt(
  value: string,
  start: number,
  end: number,
  snippet: string,
): { value: string; caret: number } {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(s, Math.min(end, value.length));
  return { value: value.slice(0, s) + snippet + value.slice(e), caret: s + snippet.length };
}
