import { lazy, memo, Suspense, useCallback, useEffect, useState } from 'react';
import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { CardHandles } from './CardHandles';
import type { CardRect } from './cardResize';
import { contrastingTextColor, SHAPE_CLASS, toCardShape } from './cardShapes';
import { screenToWorld } from './coordinates';
import type { Card } from '../api/types';
import { useCardDrag, type CardMove } from '../hooks/useCardDrag';
import { useCardResize } from '../hooks/useCardResize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useConnectionDraftStore } from '../store/connectionDraftStore';
import { useLiveRect, useLiveRectStore } from '../store/liveRectStore';
import { useViewportStore } from '../store/viewportStore';

interface CardViewProps {
  card: Card;
  selected: boolean;
  onResize: (id: string, bounds: { x: number; y: number; w: number; h: number }) => void;
  onRotate: (id: string, deg: number) => void;
  onEditContent: (id: string, content: string) => void;
  onBringToFront: (id: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onGroupMove: (moves: CardMove[]) => void;
}

const CENTERED_SHAPES = new Set(['ellipse', 'diamond', 'triangle']);

// The Markdown renderer pulls in the remark/micromark stack (~45 kB gzip); load
// it on demand so the whiteboard shell stays lean. The Suspense fallback shows the
// raw text until the chunk resolves (once per session), so content never flashes empty.
const CardMarkdown = lazy(() =>
  import('./CardMarkdown').then((m) => ({ default: m.CardMarkdown })),
);

/**
 * A card node: an un-clipped rotated wrapper (position + rotation + handlers)
 * holding a clipped shape body (fill colour + auto-contrast text), the delete
 * button, and — when selected — the resize/rotate handles. Editing shows the raw
 * Markdown source in a textarea; the display renders it via `CardMarkdown`
 * (react-markdown — no `dangerouslySetInnerHTML`, XSS-safe by construction).
 */
function CardViewImpl(props: CardViewProps) {
  const { card, selected } = props;
  const [preview, setLocalPreview] = useState<CardRect | null>(null);
  const [editing, setEditing] = useState(false);

  // Drive the card's own paint AND mirror the live geometry into the shared store
  // so the arrow layer can re-anchor connections to this card while it moves.
  const setPreview = useCallback(
    (rect: CardRect | null) => {
      setLocalPreview(rect);
      const store = useLiveRectStore.getState();
      if (rect) {
        store.setRect(card.id, rect);
      } else {
        store.clearRect(card.id);
      }
    },
    [card.id],
  );

  // Drop any live rect if the card unmounts mid-gesture (e.g. culled).
  useEffect(() => () => useLiveRectStore.getState().clearRect(card.id), [card.id]);

  // Begin dragging a relation arrow FROM this card (from a connect port).
  const onConnectStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.stopPropagation();
      const { camera, size } = useViewportStore.getState();
      const world = screenToWorld(camera, size, { x: event.clientX, y: event.clientY });
      useConnectionDraftStore.getState().begin(card.id, world);
    },
    [card.id],
  );

  const drag = useCardDrag(card, setPreview, {
    editing,
    onBringToFront: props.onBringToFront,
    onDragStart: props.onDragStart,
    onDragEnd: props.onDragEnd,
    onGroupMove: props.onGroupMove,
  });
  const { beginResize, beginRotate } = useCardResize(card, setPreview, {
    onResize: props.onResize,
    onRotate: props.onRotate,
  });

  const [saveContent, flushContent, cancelContent] = useDebouncedCallback(
    (value: string) => props.onEditContent(card.id, value),
    400,
  );

  const startEditing = (event: ReactMouseEvent<HTMLDivElement>): void => {
    event.stopPropagation(); // don't let the canvas create a new card under us
    setEditing(true);
  };

  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      cancelContent();
      setEditing(false);
    }
  };

  // Follow the shared live rect during a GROUP drag (this card may be moving even
  // though the pointer is on another card); else this card's own drag preview.
  const liveRect = useLiveRect(card.id);
  const live = liveRect ?? preview ?? card;
  const shape = toCardShape(card.shape);
  const bodyClass = `whiteboard__card-body ${SHAPE_CLASS[shape]}${
    CENTERED_SHAPES.has(shape) ? ' shape-centered' : ''
  }`;

  return (
    <div
      className={`whiteboard__card-wrapper${drag.dragging ? ' dragging' : ''}`}
      data-no-pan
      data-card-id={card.id}
      style={{
        left: live.x,
        top: live.y,
        width: live.w,
        height: live.h,
        transform: `rotate(${live.rotation}deg)`,
        transformOrigin: 'center',
        zIndex: card.zIndex,
      }}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerUp}
      onDoubleClick={startEditing}
    >
      <div
        className={bodyClass}
        style={{
          background: card.color,
          color: contrastingTextColor(card.color),
          fontSize: `${card.fontSize}px`,
        }}
      >
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
          <Suspense fallback={<div className="whiteboard__card-content">{card.content}</div>}>
            <CardMarkdown source={card.content} />
          </Suspense>
        ) : (
          <div className="whiteboard__card-content whiteboard__card-placeholder">
            Double-click to edit
          </div>
        )}
      </div>
      <button
        type="button"
        className="ghost danger whiteboard__card-delete"
        aria-label="Delete card"
        data-no-pan
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          props.onDelete(card.id);
        }}
      >
        ×
      </button>
      {selected && (
        <CardHandles
          onResize={beginResize}
          onRotate={beginRotate}
          onConnectStart={onConnectStart}
        />
      )}
    </div>
  );
}

export const CardView = memo(CardViewImpl);
