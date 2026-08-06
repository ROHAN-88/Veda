import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAllNotes } from '../hooks/useAllNotes';
import { useProjects } from '../hooks/useProjects';
import { countGroupedCards, groupNotesByProject } from '../notes/groupNotesByProject';
import { NoteItem } from '../notes/NoteItem';
import { NotesProjectFilter } from '../notes/NotesProjectFilter';
import { NotesSurface } from '../notes/NotesSurface';

/** Mirrors the single-board view: bound the first paint, then offer the rest. */
const NOTES_PAGE_SIZE = 150;

/**
 * The server's own cap (`NOTES_CARDS_MAX`). If exactly this many cards come back
 * the list is truncated, and we say so — a silently capped view reads as "this is
 * everything" when it is not.
 */
const SERVER_CAP = 2000;

/**
 * Every included project's cards in one read-only list, grouped by board.
 *
 * Renders on the theme surface with no background: `notesBg` is per-project, and
 * choosing one board's colour for a mixed list would be arbitrary.
 */
export function AllNotesPage() {
  const projects = useProjects();
  const notes = useAllNotes();
  const [limit, setLimit] = useState(NOTES_PAGE_SIZE);

  const groups = useMemo(
    () => groupNotesByProject(notes.data ?? [], projects.data ?? []),
    [notes.data, projects.data],
  );

  const total = countGroupedCards(groups);
  const capped = (notes.data?.length ?? 0) >= SERVER_CAP;

  // Page across the FLATTENED list so a huge first board can't hide every other
  // project below it, then re-slice the groups to match.
  const visible = useMemo(() => {
    let budget = limit;
    const out: typeof groups = [];
    for (const group of groups) {
      if (budget <= 0) {
        break;
      }
      out.push({ project: group.project, cards: group.cards.slice(0, budget) });
      budget -= group.cards.length;
    }
    return out;
  }, [groups, limit]);

  const remaining = total - countGroupedCards(visible);

  return (
    <>
      <div className="whiteboard-topbar">
        <Link to="/" className="whiteboard-back">
          ← Projects
        </Link>
        <span className="whiteboard-title">All notes</span>
      </div>
      <NotesSurface bg="">
        <h1 className="notes__page-title">All notes</h1>
        {projects.data && <NotesProjectFilter projects={projects.data} />}
        {renderBody()}
      </NotesSurface>
    </>
  );

  function renderBody() {
    if (notes.isError || projects.isError) {
      return (
        <>
          <p className="error">{errorMessage(notes.error ?? projects.error)}</p>
          <button type="button" className="ghost" onClick={() => void notes.refetch()}>
            Retry
          </button>
        </>
      );
    }
    if (!notes.data || !projects.data) {
      return <p className="notes__state muted">Loading notes…</p>;
    }
    if (projects.data.length === 0) {
      return (
        <p className="notes__empty muted">
          No projects yet. <Link to="/">Create your first one.</Link>
        </p>
      );
    }
    if (groups.length === 0) {
      // Distinguish "nothing selected" from "selected boards are empty" — the
      // fix is different in each case.
      const anyIncluded = projects.data.some((project) => project.notesIncluded);
      return (
        <p className="notes__empty muted">
          {anyIncluded
            ? 'The selected projects have no cards yet.'
            : 'No projects are shown. Pick at least one above.'}
        </p>
      );
    }
    return (
      <>
        {capped && (
          <p className="hint notes__capped">
            Showing the first {SERVER_CAP} cards. This board set is larger than one view can hold.
          </p>
        )}
        <div className="notes__groups">
          {visible.map((group) => (
            <section key={group.project.id}>
              <h2 className="notes__group-title">
                <Link to={`/projects/${group.project.id}`}>{group.project.name}</Link>
              </h2>
              <ul className="notes__list">
                {group.cards.map((card) => (
                  <NoteItem key={card.id} card={card} />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {remaining > 0 && (
          <button type="button" className="ghost notes__more" onClick={() => setLimit(total)}>
            Show the remaining {remaining} {remaining === 1 ? 'note' : 'notes'}
          </button>
        )}
      </>
    );
  }
}
