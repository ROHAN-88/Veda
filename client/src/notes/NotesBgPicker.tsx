import { useState, type ReactElement } from 'react';
import { PALETTE } from '../canvas/cardShapes';
import { useSetNotesBg } from '../hooks/useProjects';

/** Monochrome inline icon, matching the repo's glyph convention. */
function PaletteIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.6-1.4-.3-.4-.4-.8-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z" />
      <circle cx="7.5" cy="11.5" r="1.1" />
      <circle cx="11" cy="7.5" r="1.1" />
      <circle cx="16" cy="9.5" r="1.1" />
    </svg>
  );
}

interface NotesBgPickerProps {
  projectId: string;
  /** The project's current background, or `''` for the theme default. */
  value: string;
}

/**
 * Sets the notes view's page background.
 *
 * Collapsed to a single button by default: `.whiteboard-topbar` is fixed with
 * `max-width: calc(100vw - 1.5rem)` and does not wrap, so nine always-visible
 * controls would push the title off a narrow viewport. The expand-on-demand shape
 * follows `ProjectShareControl`.
 *
 * Owner-only — `BoardScreen` does not mount it in the read-only share view, and
 * the underlying PATCH is owner-scoped server-side regardless.
 */
export function NotesBgPicker({ projectId, value }: NotesBgPickerProps) {
  const [open, setOpen] = useState(false);
  const { mutate: setNotesBg } = useSetNotesBg(projectId);
  const current = value.toLowerCase();

  return (
    <div className="notes__bg">
      <button
        type="button"
        className="ghost view-switch__btn"
        aria-label="Notes background colour"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <PaletteIcon />
      </button>
      {open && (
        <div className="notes__bg-row" role="group" aria-label="Notes background colour">
          {/* Clearing is an explicit empty string, which is what returns the page
              to following the OS light/dark theme. */}
          <button
            type="button"
            className="ghost notes__bg-default"
            aria-pressed={current.length === 0}
            onClick={() => setNotesBg('')}
          >
            Default
          </button>
          {PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className="whiteboard__swatch"
              style={{ background: swatch }}
              aria-label={`Background ${swatch}`}
              aria-pressed={current === swatch}
              onClick={() => setNotesBg(swatch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
