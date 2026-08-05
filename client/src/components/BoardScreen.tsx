import { lazy, Suspense, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WhiteboardCanvas } from '../canvas/WhiteboardCanvas';
import { useViewMode } from '../notes/useViewMode';
import { ViewSwitch } from '../notes/ViewSwitch';

/**
 * The notes view is the lazy boundary, so its helpers AND the Markdown stack stay
 * out of the initial chunk — `CardView` already lazy-loads `CardMarkdown` for the
 * same reason, and this must not undo it.
 */
const NotesView = lazy(() =>
  import('../notes/NotesView').then((module) => ({ default: module.NotesView })),
);

interface BoardScreenProps {
  projectId: string;
  title: string;
  backTo: string;
  backLabel: string;
  /** Public share route: cards come from a pre-seeded cache, never a fetch. */
  readOnly?: boolean;
  /** Extra trailing topbar content (the share page's read-only note). */
  topbarExtra?: ReactNode;
}

/**
 * The shell both board routes share: one topbar, one view switch, one
 * whiteboard-or-notes branch.
 *
 * The switch lives HERE rather than in `CanvasHud` because the HUD is mounted
 * inside `.whiteboard`, which the notes view replaces — a toggle there would be a
 * one-way door. Keeping the branch in a single component is also what stops the two
 * pages from growing two copies of the topbar.
 *
 * Switching views does not remount the page (same route, same params), so the
 * viewport store keeps its camera and returning to the board lands exactly where
 * you left it.
 */
export function BoardScreen({
  projectId,
  title,
  backTo,
  backLabel,
  readOnly = false,
  topbarExtra,
}: BoardScreenProps) {
  const [view, setView] = useViewMode();

  return (
    <>
      <div className="whiteboard-topbar">
        <Link to={backTo} className="whiteboard-back">
          {backLabel}
        </Link>
        <span className="whiteboard-title">{title}</span>
        {topbarExtra}
        <ViewSwitch view={view} onChange={setView} />
      </div>
      {view === 'notes' ? (
        <Suspense fallback={<NotesFallback />}>
          <NotesView projectId={projectId} readOnly={readOnly} />
        </Suspense>
      ) : (
        <WhiteboardCanvas projectId={projectId} readOnly={readOnly} />
      )}
    </>
  );
}

/** Matches `NotesView`'s own loading state, so the chunk fetch is not a second style. */
function NotesFallback() {
  return (
    <div className="notes">
      <p className="notes__state muted">Loading notes…</p>
    </div>
  );
}
