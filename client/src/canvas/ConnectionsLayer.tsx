import { useMemo } from 'react';
import { ARROW_HEAD_PX } from './constants';
import { ConnectionArrow } from './ConnectionArrow';
import { arrowHead, borderPoint, toPointsAttr } from './connectionGeometry';
import { worldToScreen } from './coordinates';
import type { Card } from '../api/types';
import { useCards } from '../hooks/useCards';
import { useConnectionDraft } from '../hooks/useConnectionDraft';
import { useConnections } from '../hooks/useConnections';
import { useConnectionDraftStore } from '../store/connectionDraftStore';
import { useSelectionStore } from '../store/selectionStore';
import { useViewportStore } from '../store/viewportStore';

/**
 * Draws the relation arrows in a NON-transformed, full-viewport SVG (a sibling of
 * the world layer, like BackgroundGrid), converting each endpoint world→screen so
 * strokes stay constant width and thin lines are reliably clickable. Each arrow is
 * a memoized `ConnectionArrow` that subscribes to only its own endpoints' live
 * rects — so this layer no longer re-renders on every drag frame; only arrows
 * touching the moving card do. Also hosts the drag-to-connect gesture + rubber-band.
 */
export function ConnectionsLayer({ projectId }: { projectId: string }) {
  useConnectionDraft(projectId);

  const { data: connections = [] } = useConnections(projectId);
  const { data: cards = [] } = useCards(projectId);
  const camera = useViewportStore((state) => state.camera);
  const size = useViewportStore((state) => state.size);
  const selectedConnectionId = useSelectionStore((state) => state.selectedConnectionId);
  const selectConnection = useSelectionStore((state) => state.selectConnection);
  const draftSourceId = useConnectionDraftStore((state) => state.sourceId);
  const draftCursor = useConnectionDraftStore((state) => state.cursor);

  const cardById = useMemo(() => {
    const map = new Map<string, Card>();
    for (const card of cards) {
      map.set(card.id, card);
    }
    return map;
  }, [cards]);

  // The source card is static during a draft (you drag FROM its port), so the
  // committed rect is enough — no live-rect subscription needed here.
  const draft = (() => {
    if (!draftSourceId || !draftCursor) {
      return null;
    }
    const source = cardById.get(draftSourceId);
    if (!source) {
      return null;
    }
    const fromS = worldToScreen(camera, size, borderPoint(source, draftCursor));
    const toS = worldToScreen(camera, size, draftCursor);
    return { fromS, toS, head: toPointsAttr(arrowHead(toS, fromS, ARROW_HEAD_PX)) };
  })();

  return (
    <svg
      className="whiteboard__connections"
      width={size.width}
      height={size.height}
      aria-hidden="true"
    >
      {connections.map((conn) => {
        const source = cardById.get(conn.sourceCardId);
        const target = cardById.get(conn.targetCardId);
        if (!source || !target) {
          return null; // an endpoint card is not loaded yet (optimistic gap)
        }
        return (
          <ConnectionArrow
            key={conn.id}
            connection={conn}
            source={source}
            target={target}
            camera={camera}
            size={size}
            selected={conn.id === selectedConnectionId}
            onSelect={selectConnection}
          />
        );
      })}

      {draft && (
        <g className="whiteboard__connection-draft">
          <line x1={draft.fromS.x} y1={draft.fromS.y} x2={draft.toS.x} y2={draft.toS.y} />
          <polygon points={draft.head} />
        </g>
      )}
    </svg>
  );
}
