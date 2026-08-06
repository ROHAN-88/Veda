import { useMemo, useState } from 'react';
import { useCards } from '../hooks/useCards';
import { NoteItem } from './NoteItem';
import { sortCardsForReading } from './noteOrder';
import { NotesSurface } from './NotesSurface';
import { useViewMode } from './useViewMode';

/**
 * How many notes render before the "show the rest" button. Bounds Markdown parsing,
 * DOM size and — the expensive one — the number of video iframes on first paint.
 */
const NOTES_PAGE_SIZE = 150;

interface NotesViewProps {
  projectId: string;
  /**
   * Read-only share view. The prop name and meaning MIRROR `WhiteboardCanvas` on
   * purpose: on `/share/:token` the cards cache is pre-seeded from the one public
   * endpoint, so this view must never issue the owner-scoped request.
   */
  readOnly?: boolean;
  /** The project's chosen page background, or `''` to follow the OS theme. */
  notesBg?: string;
}

/**
 * A board's cards as a vertical, read-only list, in the order a person would read
 * them off the board. Nothing here edits — it is a projection of the whiteboard,
 * not a second store.
 */
export function NotesView({ projectId, readOnly = false, notesBg = '' }: NotesViewProps) {
  const query = useCards(projectId, { enabled: !readOnly });
  const [, setView] = useViewMode();
  const [limit, setLimit] = useState(NOTES_PAGE_SIZE);
  const cards = query.data;

  const ordered = useMemo(() => sortCardsForReading(cards ?? []), [cards]);

  if (query.isError && !cards) {
    return (
      <NotesSurface bg={notesBg}>
        <p className="error">Could not load these notes.</p>
        {/* `refetch` bypasses `enabled`, so this must never exist on the share route
            — it would fire an authed request from an anonymous page. */}
        {!readOnly && (
          <button type="button" className="ghost" onClick={() => void query.refetch()}>
            Retry
          </button>
        )}
      </NotesSurface>
    );
  }

  // Branch on the DATA, not `isLoading`: on the share route the query is disabled,
  // so `isLoading` is false from the first render while the cache seed lands one
  // render later — `isLoading` would flash the empty state on every shared link.
  if (!cards) {
    return (
      <NotesSurface bg={notesBg}>
        <p className="notes__state muted">Loading notes…</p>
      </NotesSurface>
    );
  }

  const visible = ordered.slice(0, limit);
  const remaining = ordered.length - visible.length;

  return (
    <NotesSurface bg={notesBg}>
      {/* Names the page for assistive tech without changing the visuals — the
          notes themselves have no headings, only whatever the cards contain. */}
      <h1 className="visually-hidden">Notes</h1>
      {ordered.length === 0 ? (
        <div className="notes__empty">
          <p className="muted">This board has no cards yet.</p>
          {/* You cannot create a card from a read-only list, so send the owner
              where they can. A shared-link viewer gets the message alone. */}
          {!readOnly && (
            <button type="button" className="ghost" onClick={() => setView('whiteboard')}>
              Open the whiteboard
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="notes__list">
            {visible.map((card) => (
              <NoteItem key={card.id} card={card} />
            ))}
          </ul>
          {remaining > 0 && (
            <button
              type="button"
              className="ghost notes__more"
              onClick={() => setLimit(ordered.length)}
            >
              Show the remaining {remaining} {remaining === 1 ? 'note' : 'notes'}
            </button>
          )}
        </>
      )}
    </NotesSurface>
  );
}
