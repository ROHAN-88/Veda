import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { CardView } from './CardView';
import { cardBounds, nextZIndex, paddedViewportRect } from './cardGeometry';
import { SpatialGrid } from './SpatialGrid';
import type { Card } from '../api/types';
import type { CardMove } from '../hooks/useCardDrag';
import { cardsKey, useBringToFront, useCards, useUpdateCard } from '../hooks/useCards';
import { useCardHistory } from '../hooks/useCardHistory';
import { useSelectionStore } from '../store/selectionStore';
import { useViewportStore } from '../store/viewportStore';

/**
 * Renders a project's cards inside the WorldLayer, keeps a SpatialGrid in sync for
 * viewport CULLING, and wires multi-selection + group move/resize/rotate/edit/delete.
 * Undoable edits (move/resize/rotate/delete) go through `useCardHistory`; content
 * edits + bring-to-front do not. Every selected card is kept mounted so a group
 * that spans off-screen still renders and its handles never vanish mid-gesture.
 */
export function CardsLayer({ projectId }: { projectId: string }) {
  const { data: cards = [] } = useCards(projectId);
  const camera = useViewportStore((state) => state.camera);
  const size = useViewportStore((state) => state.size);
  const queryClient = useQueryClient();
  const { mutate: mutateUpdate } = useUpdateCard(projectId); // content edits (not undoable)
  const { mutate: mutateBringToFront } = useBringToFront(projectId);
  const { commitUpdate, commitDelete } = useCardHistory(projectId);
  const selectedIds = useSelectionStore((state) => state.selectedIds);
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

  const visible = useMemo(
    () =>
      cards
        .filter(
          (card) => visibleIds.has(card.id) || card.id === draggingId || selectedIds.has(card.id),
        )
        .sort((a, b) => a.zIndex - b.zIndex),
    [cards, visibleIds, draggingId, selectedIds],
  );

  const onGroupMove = useCallback((moves: CardMove[]) => commitUpdate(moves), [commitUpdate]);
  const onResize = useCallback(
    (id: string, b: { x: number; y: number; w: number; h: number }) => commitUpdate([{ id, ...b }]),
    [commitUpdate],
  );
  const onRotate = useCallback(
    (id: string, rotation: number) => commitUpdate([{ id, rotation }]),
    [commitUpdate],
  );
  const onEditContent = useCallback(
    (id: string, content: string) => mutateUpdate({ id, patch: { content } }),
    [mutateUpdate],
  );
  const onDelete = useCallback(
    (id: string) => {
      commitDelete([id]);
      if (useSelectionStore.getState().selectedIds.has(id)) {
        clearSelection();
      }
    },
    [commitDelete, clearSelection],
  );
  const onDragStart = useCallback((id: string) => setDraggingId(id), []);
  const onDragEnd = useCallback(() => setDraggingId(null), []);

  const onBringToFront = useCallback(
    (id: string) => {
      // Read the latest cards from the cache (stable callback identity — memoized
      // CardViews then don't re-render on unrelated mutations). Server allocates
      // the authoritative zIndex; the guard just avoids a needless request.
      const current = queryClient.getQueryData<Card[]>(cardsKey(projectId)) ?? [];
      const target = current.find((card) => card.id === id);
      if (!target) {
        return;
      }
      if (target.zIndex >= nextZIndex(current) - 1) {
        return; // already on top
      }
      mutateBringToFront(id);
    },
    [queryClient, projectId, mutateBringToFront],
  );

  return (
    <>
      {visible.map((card) => (
        <CardView
          key={card.id}
          card={card}
          selected={selectedIds.has(card.id)}
          onResize={onResize}
          onRotate={onRotate}
          onEditContent={onEditContent}
          onBringToFront={onBringToFront}
          onDelete={onDelete}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onGroupMove={onGroupMove}
        />
      ))}
    </>
  );
}
