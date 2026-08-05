import type { ReactElement } from 'react';
import type { ViewMode } from './viewMode';

// Monochrome inline icons (theme via currentColor), matching the repo's glyph-icon
// convention. Board = a frame with two cards; Notes = stacked list lines.
function BoardIcon(): ReactElement {
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
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <rect x="6" y="7" width="6" height="5" rx="1" />
      <rect x="14" y="12" width="4" height="5" rx="1" />
    </svg>
  );
}

function NotesIcon(): ReactElement {
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
      <path d="M4 6h3M4 12h3M4 18h3" />
      <path d="M11 6h9M11 12h9M11 18h9" />
    </svg>
  );
}

const VIEWS: { value: ViewMode; label: string; Icon: () => ReactElement }[] = [
  { value: 'whiteboard', label: 'Whiteboard view', Icon: BoardIcon },
  { value: 'notes', label: 'Notes view — read the cards as a list', Icon: NotesIcon },
];

interface ViewSwitchProps {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}

/**
 * Segmented Whiteboard / Notes toggle for the board topbar.
 *
 * It lives in the topbar, not the canvas HUD, because the HUD is mounted inside
 * `.whiteboard` — which the notes view replaces, so a toggle there would be a
 * one-way door. Presentational on purpose: the state lives in the URL (see
 * `useViewMode`), and the owner passes it down.
 */
export function ViewSwitch({ view, onChange }: ViewSwitchProps) {
  return (
    <div className="view-switch" role="group" aria-label="Board view">
      {VIEWS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          className="ghost view-switch__btn"
          aria-label={label}
          aria-pressed={view === value}
          onClick={() => onChange(value)}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
