import { useCallback, useRef } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { useImageResize, type ImageResizeStart } from '../hooks/useImageResize';
import { imageResizeBounds } from './imageSize';

export interface CardImageBlockProps {
  src: string;
  alt: string;
  /** Explicit width in world px; absent = never resized, so the CSS default cap
   *  (`max-height: 8em`) applies. */
  width?: number;
  /** Card rotation in degrees — the drag delta is rotated into the card's own axes. */
  rotation?: number;
  /** Remove just this image from the card (never the card itself). */
  onRemove: () => void;
  /** Omitted in the read-only share view and under the Hand tool — then no grip is
   *  rendered, though an already-stored `width` is still honoured. */
  onResize?: (width: number) => void;
  /** Editor only — makes the image focusable so it can be selected then deleted. */
  blockIndex?: number;
  selected?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLSpanElement>) => void;
}

const stopPointer = (event: PointerEvent): void => event.stopPropagation();
const keepFocus = (event: MouseEvent): void => event.preventDefault();
const noop = (): void => {};

/**
 * The card's content area: the Markdown container on a rendered card, the block list in
 * the editor. Both are full-width children of `.whiteboard__card-body` with no
 * horizontal padding, on every card shape — which is what makes their `clientWidth` the
 * available content width. `closest` returns the NEAREST match, so the editor resolves
 * to the block list even though both classes are listed.
 */
const CARD_CONTENT_SELECTOR = '.whiteboard__card-content, .whiteboard__card-blocks';

/**
 * An uploaded image inside a card, with a × that removes only the image and a grip
 * that sets its width. Used by both the rendered card (via `CardMarkdown`) and the
 * block editor, so the affordances are identical in either state. `<span>`
 * (display:block via CSS) because the rendered path places it inside a Markdown
 * paragraph — which is also why the chrome is `<button>`, the only interactive
 * phrasing content valid in there.
 */
export function CardImageBlock({
  src,
  alt,
  width,
  rotation = 0,
  onRemove,
  onResize,
  blockIndex,
  selected = false,
  onKeyDown,
}: CardImageBlockProps) {
  const editable = blockIndex !== undefined;
  const imgRef = useRef<HTMLImageElement>(null);

  /**
   * `offsetWidth`/`clientWidth`, never `getBoundingClientRect()` — the latter returns
   * TRANSFORMED screen px because of the world layer's `scale(zoom)`, while these are
   * untransformed layout px, i.e. world px. Same reason `useCardResize` avoids it.
   *
   * The container is found by CLIMBING to the card's content area rather than by taking
   * `img.parentElement`, because every closer ancestor shrink-wraps the image and would
   * report the image's OWN width as its maximum — freezing the grip. Two of them do it:
   * `.whiteboard__card-image-block` is `width: fit-content` (it hugs the image so the ×
   * and grip land on the IMAGE's edges, not the card's), and on a centred shape the
   * Markdown `<p>` above it is an `align-items: center` column flex item, so it is not
   * stretched either. `clientWidth` also excludes the block editor's scrollbar, which
   * `offsetWidth` would count as available space.
   */
  const measure = useCallback((): ImageResizeStart | null => {
    const img = imgRef.current;
    if (!img) {
      return null;
    }
    const container = img.closest<HTMLElement>(CARD_CONTENT_SELECTOR);
    return imageResizeBounds(img.offsetWidth, container?.clientWidth ?? null);
  }, []);

  const { previewWidth, beginResize } = useImageResize(measure, rotation, onResize ?? noop);
  const shown = previewWidth ?? width;

  return (
    <span
      className={`whiteboard__card-image-block${selected ? ' selected' : ''}`}
      data-no-pan
      data-block-index={blockIndex}
      tabIndex={editable ? -1 : undefined}
      onKeyDown={onKeyDown}
    >
      <img
        ref={imgRef}
        className={`whiteboard__card-media-img${shown === undefined ? '' : ' sized'}`}
        style={shown === undefined ? undefined : { width: shown }}
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        draggable={false}
      />
      <button
        type="button"
        className="ghost whiteboard__card-image-remove"
        aria-label="Remove image"
        data-no-pan
        tabIndex={-1}
        onPointerDown={stopPointer}
        onMouseDown={keepFocus}
        onClick={onRemove}
      >
        ×
      </button>
      {onResize && (
        <button
          type="button"
          className="whiteboard__card-image-handle"
          aria-label="Resize image"
          data-no-pan
          tabIndex={-1}
          onPointerDown={beginResize}
          onMouseDown={keepFocus}
        />
      )}
    </span>
  );
}
