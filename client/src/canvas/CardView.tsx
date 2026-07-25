import { memo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent } from 'react';
import { applyDragDelta } from './cardGeometry';
import type { Vec2 } from './types';
import type { Card } from '../api/types';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useViewportStore } from '../store/viewportStore';

interface CardViewProps {
  card: Card;
  onMove: (id: string, pos: Vec2) => void;
  onEditContent: (id: string, content: string) => void;
  onBringToFront: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

/**
 * One card: a world-positioned DOM node (`data-no-pan` keeps the canvas from
 * panning while it's grabbed). Drag moves it (committed on release), double-click
 * edits the plain-text content (debounced save), and the × button deletes it.
 * Content is rendered as escaped React text — no `dangerouslySetInnerHTML`.
 */
function CardViewImpl({
  card,
  onMove,
  onEditContent,
  onBringToFront,
  onDelete,
  onDragStart,
  onDragEnd,
}: CardViewProps) {
  // Transient drag offset (world px) while a drag is active. On release the
  // optimistic move commit (useUpdateCard applies it synchronously) lands in the
  // same render batch as clearing this, so the card doesn't flicker back.
  const [offset, setOffset] = useState<Vec2 | null>(null);
  const [editing, setEditing] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number; startY: number } | null>(null);

  const [saveContent, flushContent, cancelContent] = useDebouncedCallback(
    (value: string) => onEditContent(card.id, value),
    400,
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || editing) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    onBringToFront(card.id);
    onDragStart(card.id);
    setOffset({ x: 0, y: 0 });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    const zoom = useViewportStore.getState().camera.zoom;
    setOffset(
      applyDragDelta(
        { x: 0, y: 0 },
        { x: event.clientX - state.startX, y: event.clientY - state.startY },
        zoom,
      ),
    );
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    try {
      event.currentTarget.releasePointerCapture(state.pointerId);
    } catch {
      // already released — ignore
    }
    drag.current = null;
    if (offset && (offset.x !== 0 || offset.y !== 0)) {
      onMove(card.id, { x: card.x + offset.x, y: card.y + offset.y });
    }
    setOffset(null);
    onDragEnd();
  };

  const startEditing = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation(); // don't let the canvas create a new card under us
    setEditing(true);
  };

  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      cancelContent();
      setEditing(false);
    }
  };

  const left = offset ? card.x + offset.x : card.x;
  const top = offset ? card.y + offset.y : card.y;

  return (
    <div
      className={`whiteboard__card${offset ? ' dragging' : ''}`}
      data-no-pan
      style={{ left, top, width: card.w, height: card.h, zIndex: card.zIndex }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={startEditing}
    >
      <button
        type="button"
        className="ghost danger whiteboard__card-delete"
        aria-label="Delete card"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(card.id);
        }}
      >
        ×
      </button>
      {editing ? (
        <textarea
          className="whiteboard__card-textarea"
          data-no-pan
          autoFocus
          defaultValue={card.content}
          onChange={(e) => saveContent(e.target.value)}
          onBlur={() => {
            flushContent();
            setEditing(false);
          }}
          onKeyDown={onTextareaKeyDown}
        />
      ) : card.content ? (
        <div className="whiteboard__card-content">{card.content}</div>
      ) : (
        <div className="whiteboard__card-content whiteboard__card-placeholder">
          Double-click to edit
        </div>
      )}
    </div>
  );
}

export const CardView = memo(CardViewImpl);
