import { useMemo } from 'react';
import { ARROW_HEAD_PX, CONNECTION_HIT_STROKE_PX, CONNECTION_STROKE_PX } from './constants';
import {
  arrowHead,
  borderPoint,
  connectionEndpoints,
  toPointsAttr,
  type AnchorRect,
} from './connectionGeometry';
import { worldToScreen } from './coordinates';
import type { Card } from '../api/types';
import { useCards } from '../hooks/useCards';
import { useConnectionDraft } from '../hooks/useConnectionDraft';
import { useConnections } from '../hooks/useConnections';
import { useConnectionDraftStore } from '../store/connectionDraftStore';
import { useLiveRectStore } from '../store/liveRectStore';
import { useSelectionStore } from '../store/selectionStore';
import { useViewportStore } from '../store/viewportStore';

/**
 * Draws the relation arrows in a NON-transformed, full-viewport SVG (a sibling of
 * the world layer, like BackgroundGrid). Each endpoint is converted world→screen,
 * so strokes stay a constant width and thin lines are reliably clickable — unlike
 * a 0×0 in-world SVG. Endpoints follow a card's LIVE rect while it's being dragged/
 * resized/rotated (via liveRectStore), otherwise its committed position. This layer
 * also hosts the drag-to-connect gesture and the rubber-band preview.
 */
export function ConnectionsLayer({ projectId }: { projectId: string }) {
  useConnectionDraft(projectId);

  const { data: connections = [] } = useConnections(projectId);
  const { data: cards = [] } = useCards(projectId);
  const camera = useViewportStore((state) => state.camera);
  const size = useViewportStore((state) => state.size);
  const liveRects = useLiveRectStore((state) => state.rects);
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

  // A card's live rect (mid-gesture) if present, else its committed position.
  const anchorOf = (id: string): AnchorRect | null => liveRects[id] ?? cardById.get(id) ?? null;

  const draft = (() => {
    if (!draftSourceId || !draftCursor) {
      return null;
    }
    const source = anchorOf(draftSourceId);
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
        const source = anchorOf(conn.sourceCardId);
        const target = anchorOf(conn.targetCardId);
        if (!source || !target) {
          return null; // an endpoint card is not loaded yet (optimistic gap)
        }
        const { from, to } = connectionEndpoints(source, target);
        const fromS = worldToScreen(camera, size, from);
        const toS = worldToScreen(camera, size, to);
        const head = toPointsAttr(arrowHead(toS, fromS, ARROW_HEAD_PX));
        const selected = conn.id === selectedConnectionId;
        return (
          <g key={conn.id} className={selected ? 'whiteboard__connection is-selected' : undefined}>
            {/* Wide transparent hit target — the visible line is too thin to click. */}
            <line
              className="whiteboard__connection-hit"
              data-no-pan
              x1={fromS.x}
              y1={fromS.y}
              x2={toS.x}
              y2={toS.y}
              strokeWidth={CONNECTION_HIT_STROKE_PX}
              onPointerDown={(event) => {
                event.stopPropagation();
                selectConnection(conn.id);
              }}
            />
            <line
              className="whiteboard__connection-line"
              x1={fromS.x}
              y1={fromS.y}
              x2={toS.x}
              y2={toS.y}
              stroke={conn.color}
              strokeWidth={selected ? CONNECTION_STROKE_PX + 2 : CONNECTION_STROKE_PX}
            />
            <polygon className="whiteboard__connection-head" points={head} fill={conn.color} />
          </g>
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
