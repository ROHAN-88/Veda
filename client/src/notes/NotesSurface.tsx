import type { ReactNode } from 'react';
import { notesSurfaceStyle } from './notesBg';

interface NotesSurfaceProps {
  /** The project's chosen background, or `''` to follow the OS theme. */
  bg: string;
  children: ReactNode;
}

/**
 * The painted page the notes view sits on.
 *
 * Every notes state renders through here — loading, error, empty, populated, and
 * the lazy-chunk fallback — because the background must not appear only once the
 * cards have arrived. Styling any one of those call sites individually would leave
 * the others on the theme surface and flash on each load.
 *
 * The outer element is full-bleed so the colour reaches the viewport edges; the
 * inner element carries the reading measure.
 */
export function NotesSurface({ bg, children }: NotesSurfaceProps) {
  return (
    <div className="notes" style={notesSurfaceStyle(bg)}>
      <div className="notes__inner">{children}</div>
    </div>
  );
}
