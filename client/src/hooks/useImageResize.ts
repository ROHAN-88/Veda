import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { resizeImageWidth } from '../canvas/imageSize';
import { useViewportStore } from '../store/viewportStore';

/** What the gesture starts from, measured off the DOM at pointer-down. */
export interface ImageResizeStart {
  /** The image's CURRENT rendered width in world px. */
  width: number;
  /** Upper bound for this drag — the CARD's content width, so the grip stops at the
   *  card edge instead of incrementing a number while nothing visibly moves. Computed
   *  by `imageResizeBounds`; measuring any closer ancestor yields the image's own width
   *  and freezes the gesture. */
  max: number;
}

export interface ImageResizeApi {
  /** Live width during a drag, world px — null when idle. Drives the inline style. */
  previewWidth: number | null;
  beginResize: (event: ReactPointerEvent<HTMLElement>) => void;
}

/**
 * Drag an image's right-edge grip to set its width. Snapshots the RENDERED width at
 * pointer-down, tracks the pointer via window listeners (reconstructing world px from
 * the screen delta ÷ zoom — no `getBoundingClientRect`), feeds a transient preview,
 * and commits exactly once on release (ADR D10) — the drag itself is the coalescing
 * mechanism, so no debounce is needed or wanted.
 *
 * `measure` returns null to refuse the gesture (image not laid out yet), which is why
 * the start width is measured rather than passed in: `max-width: 100%` means the
 * STORED width and the RENDERED width differ whenever a card was narrowed after its
 * image was sized, and "grab what you see" is the correct model.
 */
export function useImageResize(
  measure: () => ImageResizeStart | null,
  rotation: number,
  commit: (width: number) => void,
): ImageResizeApi {
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const active = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: () => void;
  } | null>(null);

  const detach = (): void => {
    if (active.current) {
      window.removeEventListener('pointermove', active.current.move);
      window.removeEventListener('pointerup', active.current.up);
      window.removeEventListener('pointercancel', active.current.cancel);
      active.current = null;
    }
  };

  // Clean up a dangling gesture if the image unmounts mid-drag (viewport culling).
  useEffect(() => detach, []);

  const beginResize = (event: ReactPointerEvent<HTMLElement>): void => {
    event.stopPropagation(); // don't let the card's own drag gesture start
    event.preventDefault(); // suppress the native image drag
    detach();
    const start = measure();
    if (!start) {
      return;
    }
    const startX = event.clientX;
    const startY = event.clientY;
    const widthAt = (e: PointerEvent): number =>
      resizeImageWidth(
        start.width,
        { dx: e.clientX - startX, dy: e.clientY - startY },
        // Re-read every move so a mid-drag wheel-zoom stays correct.
        useViewportStore.getState().camera.zoom,
        rotation,
        { max: start.max },
      );

    const move = (e: PointerEvent): void => setPreviewWidth(widthAt(e));
    const up = (e: PointerEvent): void => {
      const width = widthAt(e);
      detach();
      commit(width);
      setPreviewWidth(null);
    };
    // Abort without committing — the browser took the pointer away mid-drag.
    const cancel = (): void => {
      detach();
      setPreviewWidth(null);
    };

    active.current = { move, up, cancel };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  return { previewWidth, beginResize };
}
