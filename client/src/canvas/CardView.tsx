import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type {
  FocusEvent as ReactFocusEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { CardBlockEditor } from './CardBlockEditor';
import { removeImageBySrc, setImageWidthBySrc } from './cardBlocks';
import { CardEditToolbar } from './CardEditToolbar';
import { CardHandles } from './CardHandles';
import type { CardRect } from './cardResize';
import { contrastingTextColor, SHAPE_CLASS, toCardShape } from './cardShapes';
import { screenToWorld } from './coordinates';
import { shouldEndEditing } from './editFocus';
import { imageMarkdown } from './imageSize';
import type { Card } from '../api/types';
import { ACCEPTED_IMAGE_TYPES } from '../api/uploads';
import { useCardBlocks } from '../hooks/useCardBlocks';
import { useCardDrag, type CardMove } from '../hooks/useCardDrag';
import { useCardImageUpload } from '../hooks/useCardImageUpload';
import { useCardResize } from '../hooks/useCardResize';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { useConnectionDraftStore } from '../store/connectionDraftStore';
import { useLiveRect, useLiveRectStore } from '../store/liveRectStore';
import { useToolStore } from '../store/toolStore';
import { useViewportStore } from '../store/viewportStore';

interface CardViewProps {
  card: Card;
  selected: boolean;
  /** Read-only share view: no drag, edit, delete, resize/rotate, or connect. */
  readOnly?: boolean;
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
  const { card, selected, readOnly = false, onEditContent } = props;
  const [preview, setLocalPreview] = useState<CardRect | null>(null);
  const [editing, setEditing] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
    (value: string) => onEditContent(card.id, value),
    400,
  );

  const [editError, setEditError] = useState<string | null>(null);

  // Mirror of the newest content, including keystrokes not yet debounced to the
  // server. The editor unmounts with edit mode, so this is the only reliable base
  // for an append once it's gone. Only a GENUINE change of the prop is adopted —
  // re-reading `card.content` unconditionally would resurrect the pre-edit text in
  // the window before our own save lands in the cache.
  const contentRef = useRef(card.content);
  const lastPropContent = useRef(card.content);
  useEffect(() => {
    if (card.content !== lastPropContent.current) {
      lastPropContent.current = card.content;
      if (!editing) {
        contentRef.current = card.content;
      }
    }
  }, [card.content, editing]);

  // Every block edit reports the rejoined Markdown through the one debounced save.
  const onBlocksChange = useCallback(
    (content: string): void => {
      contentRef.current = content;
      saveContent(content);
    },
    [saveContent],
  );
  const blocks = useCardBlocks(onBlocksChange);

  // `editing` as a ref: an upload can land after edit mode has already closed, and
  // the mutation callback captured the value from when the pick started.
  const editingRef = useRef(false);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  /** Write content directly (used when the editor isn't open). */
  const replaceContent = useCallback(
    (next: string): void => {
      contentRef.current = next;
      onEditContent(card.id, next);
    },
    [card.id, onEditContent],
  );

  // Video/link Markdown goes in at the caret; if editing already ended, append it
  // rather than dropping it.
  const insertSnippet = useCallback(
    (snippet: string): void => {
      if (editingRef.current) {
        blocks.insertText(snippet);
        return;
      }
      replaceContent(contentRef.current ? `${contentRef.current}\n\n${snippet}` : snippet);
    },
    [blocks, replaceContent],
  );

  /** An uploaded image becomes its own block at the caret, splitting the text. */
  const insertImage = useCallback(
    (url: string): void => {
      if (editingRef.current) {
        blocks.insertImage(url);
        return;
      }
      const snippet = imageMarkdown(url, '');
      replaceContent(contentRef.current ? `${contentRef.current}\n${snippet}` : snippet);
    },
    [blocks, replaceContent],
  );

  /** The × on a rendered image — removes only that image, never the card. */
  const onRemoveImage = useCallback(
    (src: string): void => replaceContent(removeImageBySrc(contentRef.current, src)),
    [replaceContent],
  );

  /**
   * The resize grip on a rendered image. Deliberately un-debounced (unlike the block
   * editor's path): the drag itself already coalesces to one write per gesture, and
   * `useUpdateCard` applies its optimistic cache write synchronously — so the new
   * `card.content` lands in the same tick the drag preview clears. Deferring it would
   * re-render the OLD content against a cleared preview, i.e. a visible snap-back.
   */
  const onResizeImage = useCallback(
    (src: string, width: number): void =>
      replaceContent(setImageWidthBySrc(contentRef.current, src, width)),
    [replaceContent],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUpload = useCardImageUpload(fileInputRef, insertImage, setEditError);

  // Where the double-click landed, so the editor opens on that paragraph.
  const [openFocusY, setOpenFocusY] = useState<number | null>(null);

  const startEditing = (event: ReactMouseEvent<HTMLDivElement>): void => {
    event.stopPropagation(); // don't let the canvas create a new card under us
    setEditError(null);
    setOpenFocusY(event.clientY);
    blocks.reset(contentRef.current);
    setEditing(true);
  };

  const cancelEditing = (): void => {
    cancelContent();
    setEditing(false);
  };

  // Save on every blur, but only LEAVE edit mode on a real click-away: focus moving
  // between blocks or onto an image's × stays inside the card, and the media
  // toolbar's file picker and prompts blur the whole document (see `editFocus`).
  const onEditorBlur = (event: ReactFocusEvent<HTMLDivElement>): void => {
    flushContent();
    if (
      shouldEndEditing({
        nextFocus: event.relatedTarget,
        container: wrapperRef.current,
        documentHasFocus: document.hasFocus(),
      })
    ) {
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

  // A card is inert in the read-only share view AND while the Hand (pan) tool is
  // active: no gesture is attached, no chrome, and it drops `data-no-pan` so a
  // press over it pans the board instead.
  const tool = useToolStore((state) => state.tool);
  const inert = readOnly || tool === 'pan';
  const interaction = inert
    ? {}
    : {
        onPointerDown: drag.onPointerDown,
        onPointerMove: drag.onPointerMove,
        onPointerUp: drag.onPointerUp,
        onPointerCancel: drag.onPointerUp,
        onDoubleClick: startEditing,
      };

  return (
    <div
      ref={wrapperRef}
      className={`whiteboard__card-wrapper${drag.dragging ? ' dragging' : ''}`}
      data-no-pan={inert ? undefined : ''}
      data-card-id={card.id}
      // Tells the canvas keyboard layer not to hijack Delete/arrows in here.
      data-card-editing={editing ? '' : undefined}
      style={{
        left: live.x,
        top: live.y,
        width: live.w,
        height: live.h,
        transform: `rotate(${live.rotation}deg)`,
        transformOrigin: 'center',
        zIndex: card.zIndex,
      }}
      {...interaction}
    >
      {/* Mounted for the card's whole lifetime, not just while editing: the native
          picker outlives edit mode, and a `change` on a detached input is lost.
          Hidden from focus + a11y — the toolbar's "Image" button is its label. */}
      {!inert && (
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden
          onChange={imageUpload.onFileChange}
        />
      )}
      {editing && (
        <CardEditToolbar
          onInsert={insertSnippet}
          onPickImage={imageUpload.pickImage}
          uploading={imageUpload.isPending}
        />
      )}
      {editError && (
        <div className="whiteboard__card-edit-error" data-no-pan>
          {editError}
        </div>
      )}
      <div
        className={bodyClass}
        style={{
          background: card.color,
          color: contrastingTextColor(card.color),
          fontSize: `${card.fontSize}px`,
        }}
      >
        {editing ? (
          <CardBlockEditor
            api={blocks}
            initialFocusY={openFocusY}
            rotation={card.rotation}
            onBlur={onEditorBlur}
            onEscape={cancelEditing}
          />
        ) : card.content ? (
          <Suspense fallback={<div className="whiteboard__card-content">{card.content}</div>}>
            <CardMarkdown
              source={card.content}
              onRemoveImage={inert ? undefined : onRemoveImage}
              onResizeImage={inert ? undefined : onResizeImage}
              rotation={card.rotation}
            />
          </Suspense>
        ) : (
          <div className="whiteboard__card-content whiteboard__card-placeholder">
            Double-click to edit
          </div>
        )}
      </div>
      {!inert && (
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
      )}
      {selected && !inert && (
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
