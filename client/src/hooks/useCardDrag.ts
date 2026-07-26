import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CardRect } from '../canvas/cardResize';
import type { Vec2 } from '../canvas/types';
import type { Card } from '../api/types';
import { cardsKey } from './useCards';
import { useLiveRectStore } from '../store/liveRectStore';
import { useSelectionStore } from '../store/selectionStore';
import { useViewportStore } from '../store/viewportStore';

/** One card's new committed position after a (group) drag. */
export interface CardMove {
  id: string;
  x: number;
  y: number;
}

interface DragCallbacks {
  editing: boolean;
  onBringToFront: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  /** Commit the whole moved group (1..N cards) as one atomic update. */
  onGroupMove: (moves: CardMove[]) => void;
}

const toRect = (card: Card): CardRect => ({
  x: card.x,
  y: card.y,
  w: card.w,
  h: card.h,
  rotation: card.rotation,
});

/**
 * Drag-to-move — selection-aware (Phase 8). A press selects the card (Shift-click
 * toggles membership and does not drag); if the pressed card is part of a
 * multi-selection, the WHOLE selection drags. The pressed card's own `preview`
 * plus every other selected card's rect are broadcast through `liveRectStore` so
 * the group (and any attached arrows) follows live; one atomic `onGroupMove`
 * commits on release (ADR D10).
 */
export function useCardDrag(
  card: Card,
  setPreview: (preview: CardRect | null) => void,
  cbs: DragCallbacks,
) {
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    group: { id: string; base: CardRect }[];
  } | null>(null);

  const worldDelta = (event: { clientX: number; clientY: number }): Vec2 => {
    const zoom = useViewportStore.getState().camera.zoom;
    return {
      x: (event.clientX - (drag.current?.startX ?? 0)) / zoom,
      y: (event.clientY - (drag.current?.startY ?? 0)) / zoom,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || cbs.editing) {
      return;
    }
    event.stopPropagation();
    const selection = useSelectionStore.getState();
    if (event.shiftKey) {
      selection.toggle(card.id); // toggle membership, don't start a drag
      return;
    }
    // Drag the whole selection if this card is part of a multi-selection; else
    // select just this card and drag it alone.
    let ids: string[];
    if (selection.selectedIds.has(card.id) && selection.selectedIds.size > 1) {
      ids = [...selection.selectedIds];
    } else {
      selection.select(card.id);
      ids = [card.id];
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    cbs.onBringToFront(card.id);
    cbs.onDragStart(card.id);

    const cards = queryClient.getQueryData<Card[]>(cardsKey(card.projectId)) ?? [];
    const byId = new Map(cards.map((c) => [c.id, c]));
    const group = ids
      .map((id) => byId.get(id))
      .filter((c): c is Card => Boolean(c))
      .map((c) => ({ id: c.id, base: toRect(c) }));

    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      group,
    };
    setDragging(true);
    const self = group.find((g) => g.id === card.id);
    if (self) {
      setPreview(self.base);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointerId) {
      return;
    }
    const d = worldDelta(event);
    const live = useLiveRectStore.getState();
    for (const g of state.group) {
      const rect = { ...g.base, x: g.base.x + d.x, y: g.base.y + d.y };
      if (g.id === card.id) {
        setPreview(rect); // pressed card: local preview (dual-writes its live rect)
      } else {
        live.setRect(g.id, rect); // other selected cards: broadcast only
      }
    }
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
    const d = worldDelta(event);
    const live = useLiveRectStore.getState();
    if (d.x !== 0 || d.y !== 0) {
      cbs.onGroupMove(state.group.map((g) => ({ id: g.id, x: g.base.x + d.x, y: g.base.y + d.y })));
    }
    for (const g of state.group) {
      if (g.id !== card.id) {
        live.clearRect(g.id);
      }
    }
    drag.current = null;
    setDragging(false);
    setPreview(null);
    cbs.onDragEnd();
  };

  return { dragging, onPointerDown, onPointerMove, onPointerUp };
}
