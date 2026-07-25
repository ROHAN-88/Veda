import { useCallback, useMemo, useState } from 'react';
import { CardView } from './CardView';
import { cardBounds, nextZIndex, paddedViewportRect } from './cardGeometry';
import { SpatialGrid } from './SpatialGrid';
import type { Vec2 } from './types';
import { useCards, useDeleteCard, useUpdateCard } from '../hooks/useCards';
import { useViewportStore } from '../store/viewportStore';

/**
 * Renders a project's cards inside the WorldLayer and keeps a real SpatialGrid in
 * sync with them. The grid drives viewport CULLING — only cards intersecting the
 * padded viewport rect (plus the one being dragged) are mounted — which is the
 * production use the Phase 3 index was built for.
 */
export function CardsLayer({ projectId }: { projectId: string }) {
  const { data: cards = [] } = useCards(projectId);
  const camera = useViewportStore((state) => state.camera);
  const size = useViewportStore((state) => state.size);
  const { mutate: mutateUpdate } = useUpdateCard(projectId);
  const { mutate: mutateDelete } = useDeleteCard(projectId);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Rebuilds whenever the (optimistically-updated) card list changes — no drift.
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
    .filter((card) => visibleIds.has(card.id) || card.id === draggingId)
    .sort((a, b) => a.zIndex - b.zIndex); // DOM order matches stacking order

  const onMove = useCallback(
    (id: string, pos: Vec2) => mutateUpdate({ id, patch: { x: pos.x, y: pos.y } }),
    [mutateUpdate],
  );
  const onEditContent = useCallback(
    (id: string, content: string) => mutateUpdate({ id, patch: { content } }),
    [mutateUpdate],
  );
  const onDelete = useCallback((id: string) => mutateDelete(id), [mutateDelete]);
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
          onMove={onMove}
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
