import { memo } from 'react';
import { ARROW_HEAD_PX, CONNECTION_HIT_STROKE_PX, CONNECTION_STROKE_PX } from './constants';
import { arrowHead, connectionEndpoints, toPointsAttr } from './connectionGeometry';
import { worldToScreen } from './coordinates';
import type { Camera, Size } from './types';
import type { Card, Connection } from '../api/types';
import { useLiveRect } from '../store/liveRectStore';

interface ConnectionArrowProps {
  connection: Connection;
  source: Card;
  target: Card;
  camera: Camera;
  size: Size;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * One relation arrow. It subscribes to ONLY its two endpoints' live rects
 * (`useLiveRect`), so dragging an unrelated card never re-renders it — that's the
 * perf win over the layer subscribing to the whole live-rect map. `memo` keeps it
 * from re-rendering when sibling arrows change.
 */
function ConnectionArrowImpl({
  connection,
  source,
  target,
  camera,
  size,
  selected,
  onSelect,
}: ConnectionArrowProps) {
  // Follow a card's LIVE geometry mid-gesture; fall back to its committed rect.
  const srcRect = useLiveRect(source.id) ?? source;
  const tgtRect = useLiveRect(target.id) ?? target;

  const { from, to } = connectionEndpoints(srcRect, tgtRect);
  const fromS = worldToScreen(camera, size, from);
  const toS = worldToScreen(camera, size, to);
  const head = toPointsAttr(arrowHead(toS, fromS, ARROW_HEAD_PX));
  const mid = { x: (fromS.x + toS.x) / 2, y: (fromS.y + toS.y) / 2 };

  return (
    <g className={selected ? 'whiteboard__connection is-selected' : undefined}>
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
          onSelect(connection.id);
        }}
      />
      <line
        className="whiteboard__connection-line"
        x1={fromS.x}
        y1={fromS.y}
        x2={toS.x}
        y2={toS.y}
        stroke={connection.color}
        strokeWidth={selected ? CONNECTION_STROKE_PX + 2 : CONNECTION_STROKE_PX}
      />
      <polygon className="whiteboard__connection-head" points={head} fill={connection.color} />
      {connection.label && (
        <text
          className="whiteboard__connection-label"
          x={mid.x}
          y={mid.y}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {connection.label}
        </text>
      )}
    </g>
  );
}

export const ConnectionArrow = memo(ConnectionArrowImpl);
