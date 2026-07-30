import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import { nearestTextBlock } from './cardBlocks';
import { CardImageBlock } from './CardImageBlock';
import type { CardBlocksApi } from '../hooks/useCardBlocks';

interface CardBlockEditorProps {
  api: CardBlocksApi;
  /** Client Y of the double-click that opened the editor — picks the first block. */
  initialFocusY: number | null;
  /** Fires on focusout of any block (bubbles) — the card decides whether to close. */
  onBlur: (event: ReactFocusEvent<HTMLDivElement>) => void;
  onEscape: () => void;
}

/** Grow a textarea to fit its content — blocks stack, so none of them scrolls. */
function autoSize(element: HTMLTextAreaElement | null): void {
  if (element) {
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }
}

/**
 * The in-place card editor: text blocks are textareas, image blocks stay rendered
 * as pictures, in the order they were authored. Arrow keys walk across images;
 * Backspace at the start of a block selects the image above it, and a second press
 * removes it (two steps, because card content edits are not undoable).
 */
export function CardBlockEditor({ api, initialFocusY, onBlur, onEscape }: CardBlockEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const { blocks, focusRequest, reportCaret, removeImage, setText } = api;

  const focusText = useCallback(
    (index: number, caret: number): void => {
      const element = containerRef.current?.querySelector<HTMLTextAreaElement>(
        `textarea[data-block-index="${index}"]`,
      );
      if (!element) {
        return;
      }
      setSelectedImage(null);
      const at = Math.min(caret, element.value.length);
      element.focus();
      element.setSelectionRange(at, at);
      reportCaret(index, at);
    },
    [reportCaret],
  );

  const focusImage = useCallback((index: number): void => {
    const element = containerRef.current?.querySelector<HTMLElement>(
      `[data-block-index="${index}"]`,
    );
    if (element) {
      setSelectedImage(index);
      element.focus();
    }
  }, []);

  /** Nearest text block in the given direction, or null at the ends. */
  const textNeighbour = useCallback(
    (from: number, step: -1 | 1): number | null => {
      for (let i = from + step; i >= 0 && i < blocks.length; i += step) {
        if (blocks[i].kind === 'text') {
          return i;
        }
      }
      return null;
    },
    [blocks],
  );

  const focusTextEnd = useCallback(
    (index: number): void => {
      const block = blocks[index];
      focusText(index, block?.kind === 'text' ? block.text.length : 0);
    },
    [blocks, focusText],
  );

  // Keep every textarea sized to its content, including ones added by an insert.
  useEffect(() => {
    containerRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea').forEach(autoSize);
  }, [blocks]);

  // Open on the block the user double-clicked, so the caret lands in that paragraph.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || blocks.length === 0) {
      return;
    }
    opened.current = true;
    const areas = containerRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea') ?? [];
    const rects = [...areas].map((element) => {
      const rect = element.getBoundingClientRect();
      return { index: Number(element.dataset.blockIndex), top: rect.top, bottom: rect.bottom };
    });
    if (rects.length > 0) {
      focusTextEnd(
        initialFocusY === null ? rects[0].index : nearestTextBlock(rects, initialFocusY),
      );
    }
  }, [blocks, focusTextEnd, initialFocusY]);

  // Apply a focus move requested by a structural change (insert / remove). The
  // request carries a nonce, so repeating the same position still re-fires.
  useEffect(() => {
    if (focusRequest) {
      focusText(focusRequest.index, focusRequest.caret);
    }
  }, [focusRequest, focusText]);

  const onTextKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>, index: number): void => {
    const element = event.currentTarget;
    if (event.key === 'Escape') {
      onEscape();
      return;
    }
    const collapsed = element.selectionStart === element.selectionEnd;
    const atStart = collapsed && element.selectionStart === 0;
    const atEnd = collapsed && element.selectionStart === element.value.length;

    if (event.key === 'Backspace' && atStart && blocks[index - 1]?.kind === 'image') {
      event.preventDefault();
      focusImage(index - 1); // select it; a second Backspace/Delete removes it
      return;
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowLeft') && atStart) {
      const previous = textNeighbour(index, -1);
      if (previous !== null) {
        event.preventDefault();
        focusTextEnd(previous);
      }
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowRight') && atEnd) {
      const next = textNeighbour(index, 1);
      if (next !== null) {
        event.preventDefault();
        focusText(next, 0);
      }
    }
  };

  const onImageKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>, index: number): void => {
    if (event.key === 'Escape') {
      onEscape();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeImage(index);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      const previous = textNeighbour(index, -1);
      if (previous !== null) {
        event.preventDefault();
        focusTextEnd(previous);
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      const next = textNeighbour(index, 1);
      if (next !== null) {
        event.preventDefault();
        focusText(next, 0);
      }
    }
  };

  // Clicking the empty space under the blocks continues the last one, like a doc.
  const onContainerMouseDown = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }
    const last = textNeighbour(blocks.length, -1);
    if (last !== null) {
      event.preventDefault();
      focusTextEnd(last);
    }
  };

  return (
    <div
      ref={containerRef}
      className="whiteboard__card-blocks"
      data-no-pan
      onMouseDown={onContainerMouseDown}
      onBlur={onBlur}
    >
      {blocks.map((block, index) =>
        block.kind === 'image' ? (
          <CardImageBlock
            key={`image-${index}-${block.src}`}
            src={block.src}
            alt={block.alt}
            blockIndex={index}
            selected={selectedImage === index}
            onRemove={() => removeImage(index)}
            onKeyDown={(event) => onImageKeyDown(event, index)}
          />
        ) : (
          <textarea
            key={`text-${index}`}
            className="whiteboard__card-text-block"
            data-no-pan
            data-block-index={index}
            rows={1}
            value={block.text}
            onChange={(event) => {
              autoSize(event.currentTarget);
              setText(index, event.currentTarget.value);
            }}
            onSelect={(event) => reportCaret(index, event.currentTarget.selectionStart)}
            onFocus={(event) => {
              setSelectedImage(null);
              reportCaret(index, event.currentTarget.selectionStart);
            }}
            onKeyDown={(event) => onTextKeyDown(event, index)}
          />
        ),
      )}
    </div>
  );
}
