import type { Card } from '../api/types';
import { CardMarkdown } from '../canvas/CardMarkdown';

/**
 * One card rendered as a note: its content, nothing else.
 *
 * There is deliberately no heading. A card has no title column, so any title had
 * to be derived from the first line of `content` — which the body then rendered
 * again directly underneath, so every note showed its opening line twice.
 *
 * The body is `CardMarkdown` with no editing props — that path IS the read-only
 * renderer used by the public share view, so the notes view inherits its security
 * properties (no `rehype-raw`, image `src` restricted to same-origin uploads,
 * sandboxed video embeds) rather than duplicating the XSS surface in a second
 * pipeline.
 *
 * A card's `shape`, `rotation`, `fontSize` and `color` are ignored: they are
 * canvas presentation. A tilted row is unreadable, the shape classes clip text to
 * a fixed-size box, and a 96px font would give a wall of giant paragraphs instead
 * of one consistent reading scale.
 *
 * No hooks and no data access, which is what makes it renderable with
 * `renderToStaticMarkup` in the node test environment.
 */
interface NoteItemProps {
  card: Card;
}

export function NoteItem({ card }: NoteItemProps) {
  const isEmpty = card.content.trim().length === 0;

  return (
    <li className="notes__item">
      <div className="notes__body">
        {/* Not the canvas's "Double-click to edit" placeholder — that copy
            promises editing this view does not have. */}
        {isEmpty ? <p className="muted">Empty card</p> : <CardMarkdown source={card.content} />}
      </div>
    </li>
  );
}
