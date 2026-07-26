import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  cardCenter,
  handleWorldPos,
  resizeCard,
  rotateCard,
  rotateHandleWorldPos,
  type CardRect,
  type Handle,
} from '../canvas/cardResize';
import { ROTATE_HANDLE_OFFSET_PX } from '../canvas/constants';
import type { Vec2 } from '../canvas/types';
import type { Card } from '../api/types';
import { useViewportStore } from '../store/viewportStore';

interface ResizeCallbacks {
  onResize: (id: string, bounds: { x: number; y: number; w: number; h: number }) => void;
  onRotate: (id: string, deg: number) => void;
}

const toRect = (card: Card): CardRect => ({
  x: card.x,
  y: card.y,
  w: card.w,
  h: card.h,
  rotation: card.rotation,
});

/**
 * Resize (8 handles) and rotate a card. Each gesture snapshots the card at
 * pointer-down, tracks the pointer via window listeners (reconstructing the world
 * position from the screen delta ÷ zoom — no getBoundingClientRect), feeds a
 * transient `preview`, and commits one optimistic PATCH on release (ADR D10).
 */
export function useCardResize(
  card: Card,
  setPreview: (preview: CardRect | null) => void,
  cbs: ResizeCallbacks,
) {
  const active = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void } | null>(
    null,
  );

  const detach = (): void => {
    if (active.current) {
      window.removeEventListener('pointermove', active.current.move);
      window.removeEventListener('pointerup', active.current.up);
      active.current = null;
    }
  };

  // Clean up a dangling gesture if the card unmounts mid-drag.
  useEffect(() => detach, []);

  const track = (
    handleW0: Vec2,
    start: Vec2,
    apply: (worldPointer: Vec2, event: PointerEvent) => void,
    commit: (worldPointer: Vec2, event: PointerEvent) => void,
  ): void => {
    const worldAt = (event: PointerEvent): Vec2 => {
      const zoom = useViewportStore.getState().camera.zoom;
      return {
        x: handleW0.x + (event.clientX - start.x) / zoom,
        y: handleW0.y + (event.clientY - start.y) / zoom,
      };
    };
    const move = (event: PointerEvent): void => apply(worldAt(event), event);
    const up = (event: PointerEvent): void => {
      const world = worldAt(event);
      detach();
      commit(world, event);
      setPreview(null);
    };
    active.current = { move, up };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const beginResize = (handle: Handle, event: ReactPointerEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    detach();
    const card0 = toRect(card);
    track(
      handleWorldPos(card0, handle),
      { x: event.clientX, y: event.clientY },
      (world) => setPreview({ ...resizeCard(card0, handle, world), rotation: card0.rotation }),
      (world) => cbs.onResize(card.id, resizeCard(card0, handle, world)),
    );
  };

  const beginRotate = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    detach();
    const card0 = toRect(card);
    const center = cardCenter(card0);
    track(
      rotateHandleWorldPos(card0, ROTATE_HANDLE_OFFSET_PX),
      { x: event.clientX, y: event.clientY },
      (world, e) =>
        setPreview({ ...card0, rotation: rotateCard(center, world, { snap: e.shiftKey }) }),
      (world, e) => cbs.onRotate(card.id, rotateCard(center, world, { snap: e.shiftKey })),
    );
  };

  return { beginResize, beginRotate };
}
