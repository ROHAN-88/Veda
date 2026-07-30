import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';

export interface CardImageBlockProps {
  src: string;
  alt: string;
  /** Remove just this image from the card (never the card itself). */
  onRemove: () => void;
  /** Editor only — makes the image focusable so it can be selected then deleted. */
  blockIndex?: number;
  selected?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLSpanElement>) => void;
}

const stopPointer = (event: PointerEvent): void => event.stopPropagation();
const keepFocus = (event: MouseEvent): void => event.preventDefault();

/**
 * An uploaded image inside a card, with a × that removes only the image. Used by
 * both the rendered card (via `CardMarkdown`) and the block editor, so the
 * affordance is identical in either state. `<span>` (display:block via CSS) because
 * the rendered path places it inside a Markdown paragraph.
 */
export function CardImageBlock({
  src,
  alt,
  onRemove,
  blockIndex,
  selected = false,
  onKeyDown,
}: CardImageBlockProps) {
  const editable = blockIndex !== undefined;
  return (
    <span
      className={`whiteboard__card-image-block${selected ? ' selected' : ''}`}
      data-no-pan
      data-block-index={blockIndex}
      tabIndex={editable ? -1 : undefined}
      onKeyDown={onKeyDown}
    >
      <img
        className="whiteboard__card-media-img"
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
    </span>
  );
}
