import { useCallback, useMemo, useState } from 'react';
import { CardView } from './CardView';
import { cardBounds, nextZIndex, paddedViewportRect } from './cardGeometry';
import { SpatialGrid } from './SpatialGrid';
import type { Vec2 } from './types';
import { useCards, useDeleteCard, useUpdateCard } from '../hooks/useCards';
import { useSelectionStore } from '../store/selectionStore';
import { useViewportStore } from '../store/viewportStore';

/**
 * Renders a project's cards inside the WorldLayer, keeps a SpatialGrid in sync for
 * viewport CULLING, and wires selection + move/resize/rotate/edit/delete. Culling
 * uses each card's axis-aligned `x,y,w,h` (rotation ignored — the padded viewport
 * over-includes, so a rotated corner is never dropped early). The dragged and the
 * selected card are always kept mounted so their handles don't vanish mid-gesture.
 */
export function CardsLayer({ projectId }: { projectId: string }) {
  const { data: cards = [] } = useCards(projectId);
  const camera = useViewportStore((state) => state.camera);
  const size = useViewportStore((state) => state.size);
  const { mutate: mutateUpdate } = useUpdateCard(projectId);
  const { mutate: mutateDelete } = useDeleteCard(projectId);
  const selectedId = useSelectionStore((state) => state.selectedId);
  const select = useSelectionStore((state) => state.select);
  const clearSelection = useSelectionStore((state) => state.clear);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const grid = useMemo(() => {
    const next = new SpatialGrid();
    for (const card of cards) {
      next.insert(card.id, cardBounds(card));
    }
    return next;
  }, [cards]);

  const visibleIds = useMemo(
    () => grid.search(paddedViewportRect(camera, size)),
    [grid, camera, size],
  );

  const visible = cards
    .filter((card) => visibleIds.has(card.id) || card.id === draggingId || card.id === selectedId)
    .sort((a, b) => a.zIndex - b.zIndex);

  const onMove = useCallback(
    (id: string, pos: Vec2) => mutateUpdate({ id, patch: { x: pos.x, y: pos.y } }),
    [mutateUpdate],
  );
  const onResize = useCallback(
    (id: string, b: { x: number; y: number; w: number; h: number }) =>
      mutateUpdate({ id, patch: b }),
    [mutateUpdate],
  );
  const onRotate = useCallback(
    (id: string, rotation: number) => mutateUpdate({ id, patch: { rotation } }),
    [mutateUpdate],
  );
  const onEditContent = useCallback(
    (id: string, content: string) => mutateUpdate({ id, patch: { content } }),
    [mutateUpdate],
  );
  const onDelete = useCallback(
    (id: string) => {
      mutateDelete(id);
      if (useSelectionStore.getState().selectedId === id) {
        clearSelection();
      }
    },
    [mutateDelete, clearSelection],
  );
  const onDragStart = useCallback((id: string) => setDraggingId(id), []);
  const onDragEnd = useCallback(() => setDraggingId(null), []);

  const onBringToFront = useCallback(
    (id: string) => {
      const target = cards.find((card) => card.id === id);
      if (!target) {
        return;
      }
      const top = nextZIndex(cards) - 1; // current max
      if (target.zIndex >= top) {
        return; // already on top — skip a needless PATCH
      }
      mutateUpdate({ id, patch: { zIndex: nextZIndex(cards) } });
    },
    [cards, mutateUpdate],
  );

  return (
    <>
      {visible.map((card) => (
        <CardView
          key={card.id}
          card={card}
          selected={card.id === selectedId}
          onSelect={select}
          onMove={onMove}
          onResize={onResize}
          onRotate={onRotate}
          onEditContent={onEditContent}
          onBringToFront={onBringToFront}
          onDelete={onDelete}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </>
  );
}
