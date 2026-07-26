import { useEffect, useRef } from 'react';
import { screenToWorld } from '../canvas/coordinates';
import type { Connection } from '../api/types';
import { useConnectionDraftStore } from '../store/connectionDraftStore';
import { useViewportStore } from '../store/viewportStore';
import { useConnections, useCreateConnection } from './useConnections';

/**
 * Drives the "drag from a card port to another card" gesture. A port's
 * pointer-down calls `connectionDraftStore.begin(sourceId, …)`; from then on this
 * hook (mounted once, in ConnectionsLayer) tracks the pointer via window listeners
 * — `.whiteboard` is fixed at `inset:0`, so client coords are already canvas-local.
 * On release it resolves the drop target with `elementFromPoint` + `data-card-id`
 * and, if it's a different card not already linked, creates the connection. The
 * server is still the authority (self-link → 400, duplicate → 409); the client
 * checks only to avoid an obviously doomed request.
 */
export function useConnectionDraft(projectId: string): void {
  const sourceId = useConnectionDraftStore((state) => state.sourceId);
  const move = useConnectionDraftStore((state) => state.move);
  const clear = useConnectionDraftStore((state) => state.clear);
  const { data: connections = [] } = useConnections(projectId);
  const { mutate: createConnection } = useCreateConnection(projectId);

  // Latest connections without re-attaching listeners on every refetch.
  const connectionsRef = useRef<Connection[]>(connections);
  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  useEffect(() => {
    if (!sourceId) {
      return;
    }
    const onMove = (event: PointerEvent): void => {
      const { camera, size } = useViewportStore.getState();
      move(screenToWorld(camera, size, { x: event.clientX, y: event.clientY }));
    };
    const onUp = (event: PointerEvent): void => {
      const dropEl = document.elementFromPoint(event.clientX, event.clientY);
      const targetId = dropEl?.closest<HTMLElement>('[data-card-id]')?.dataset.cardId ?? null;
      const alreadyLinked = connectionsRef.current.some(
        (conn) => conn.sourceCardId === sourceId && conn.targetCardId === targetId,
      );
      if (targetId && targetId !== sourceId && !alreadyLinked) {
        createConnection({ sourceCardId: sourceId, targetCardId: targetId });
      }
      clear();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [sourceId, move, clear, createConnection]);
}
