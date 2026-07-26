import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { applyDragDelta } from '../canvas/cardGeometry';
import type { CardRect } from '../canvas/cardResize';
import type { Vec2 } from '../canvas/types';
import type { Card } from '../api/types';
import { useViewportStore } from '../store/viewportStore';

interface DragCallbacks {
  editing: boolean;
  onSelect: (id: string) => void;
  onBringToFront: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onMove: (id: string, pos: Vec2) => void;
}

const toRect = (card: Card): CardRect => ({
  x: card.x,
  y: card.y,
  w: card.w,
  h: card.h,
  rotation: card.rotation,
});

/**
 * Drag-to-move a card. Pointer handlers attach to the card wrapper (pointer
 * capture keeps the gesture there); moves feed a transient `preview`, and the
 * committed position is one optimistic PATCH on release (ADR D10).
 */
export function useCardDrag(
  card: Card,
  setPreview: (preview: CardRect | null) => void,
  cbs: DragCallbacks,
) {
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    card0: CardRect;
  } | null>(null);

  const worldPos = (event: ReactPointerEvent<HTMLDivElement>, card0: CardRect): Vec2 => {
    const zoom = useViewportStore.getState().camera.zoom;
    return applyDragDelta(
      { x: card0.x, y: card0.y },
      {
        x: event.clientX - (drag.current?.startX ?? 0),
        y: event.clientY - (drag.current?.startY ?? 0),
      },
      zoom,
    );
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || cbs.editing) {
      return;
    }
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    cbs.onSelect(card.id);
    cbs.onBringToFront(card.id);
    cbs.onDragStart(card.id);
    const card0 = toRect(card);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      card0,
    };
    setDragging(true);
    setPreview(card0);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    const pos = worldPos(event, state.card0);
    setPreview({ ...state.card0, x: pos.x, y: pos.y });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    try {
      event.currentTarget.releasePointerCapture(state.pointerId);
    } catch {
      // already released — ignore
    }
    const pos = worldPos(event, state.card0);
    if (pos.x !== state.card0.x || pos.y !== state.card0.y) {
      cbs.onMove(card.id, pos);
    }
    drag.current = null;
    setDragging(false);
    setPreview(null);
    cbs.onDragEnd();
  };

  return { dragging, onPointerDown, onPointerMove, onPointerUp };
}
