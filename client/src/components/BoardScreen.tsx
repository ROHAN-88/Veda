import { lazy, Suspense, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WhiteboardCanvas } from '../canvas/WhiteboardCanvas';
import { NotesBgPicker } from '../notes/NotesBgPicker';
import { NotesSurface } from '../notes/NotesSurface';
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
  /**
   * The project's notes-view background. Passed DOWN rather than fetched: the
   * share route seeds only the cards and connections caches, so a `useProject`
   * call in this path would fire the owner-scoped endpoint from an anonymous
   * page. The share route simply omits it and gets the theme default.
   */
  notesBg?: string;
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
  notesBg = '',
}: BoardScreenProps) {
  const [view, setView] = useViewMode();
  const notes = view === 'notes';

  return (
    <>
      <div className="whiteboard-topbar">
        <Link to={backTo} className="whiteboard-back">
          {backLabel}
        </Link>
        <span className="whiteboard-title">{title}</span>
        {topbarExtra}
        {/* Only where it applies, and only for someone who can change it. */}
        {notes && !readOnly && <NotesBgPicker projectId={projectId} value={notesBg} />}
        <ViewSwitch view={view} onChange={setView} />
      </div>
      {notes ? (
        <Suspense fallback={<NotesFallback bg={notesBg} />}>
          <NotesView projectId={projectId} readOnly={readOnly} notesBg={notesBg} />
        </Suspense>
      ) : (
        <WhiteboardCanvas projectId={projectId} readOnly={readOnly} />
      )}
    </>
  );
}

/**
 * Matches `NotesView`'s own loading state, so the chunk fetch is not a second
 * style — and paints the same background, so the colour does not appear only once
 * the lazy chunk lands.
 */
function NotesFallback({ bg }: { bg: string }) {
  return (
    <NotesSurface bg={bg}>
      <p className="notes__state muted">Loading notes…</p>
    </NotesSurface>
  );
}
