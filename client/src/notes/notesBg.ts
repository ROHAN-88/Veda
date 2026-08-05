import type { CSSProperties } from 'react';
import { contrastingTextColor } from '../canvas/cardShapes';

/**
 * The notes view's page background — a user-chosen colour stored on the project.
 *
 * Empty means "no choice made": the view then inherits `Canvas`/`CanvasText` from
 * the root `color-scheme: light dark` and follows the OS theme, which is why the
 * stored default is `''` and not a hex.
 *
 * Pure — no DOM, no React state — so the contrast behaviour is testable in the
 * node environment the client suite runs in.
 */

/**
 * A hex background, or empty. MIRRORS the server's `NOTES_BG` regex
 * (`server/src/cards/../update-project.dto.ts`) — the server is the control, this
 * is defence in depth, because the value is interpolated into a `style` attribute.
 * Keep the two in step.
 */
const NOTES_BG = /^(#[0-9a-fA-F]{6})?$/;

export function isNotesBg(value: string): boolean {
  return NOTES_BG.test(value);
}

/**
 * Inline style for the notes surface. `{}` when no background is set (or the
 * stored value is not one we are willing to emit), so the page keeps following
 * the theme.
 *
 * When a colour IS set the text colour is pinned alongside it. That pairing is
 * mandatory, not decorative: under a dark OS theme the inherited text is light,
 * so a light swatch would render light-on-light. Same treatment `CardView` gives
 * a card's own fill.
 */
export function notesSurfaceStyle(bg: string): CSSProperties {
  if (bg.length === 0 || !isNotesBg(bg)) {
    return {};
  }
  return { background: bg, color: contrastingTextColor(bg) };
}
