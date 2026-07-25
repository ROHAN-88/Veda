/**
 * Wires pan (pointer drag) and zoom (wheel / ctrl+wheel) onto the given element,
 * driving the viewport store.
 *
 * Design notes:
 * - The wheel handler is a NATIVE listener registered with `{ passive: false }`
 *   so it can `preventDefault()` — React's synthetic `onWheel` is passive and
 *   cannot reliably stop the browser's page scroll / ctrl+wheel page zoom.
 * - Every listener is added and removed in the same effect, so React StrictMode's
 *   dev double-invoke (mount -> cleanup -> mount) leaves exactly one of each.
 * - Pointer capture is released on unmount and on all drag-end events.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { ZOOM_SENSITIVITY } from '../canvas/constants';
import { useViewportStore } from '../store/viewportStore';

interface DragState {
  pointerId: number;
  lastX: number;
  lastY: number;
}

export function usePanZoom<T extends HTMLElement>(ref: RefObject<T | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    // Store actions have stable identity, so capturing them once is safe.
    const { panByScreen, zoomAtPoint } = useViewportStore.getState();
    let drag: DragState | null = null;

    const localPoint = (event: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 1) {
        return; // primary / middle only
      }
      // Never start a pan when the press begins on an interactive control (HUD).
      const target = event.target as Element | null;
      if (target && target.closest('button, a, input, [data-no-pan]')) {
        return;
      }
      drag = { pointerId: event.pointerId, lastX: event.clientX, lastY: event.clientY };
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // stale/invalid pointer id — safe to ignore
      }
      el.classList.add('grabbing');
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      const dx = event.clientX - drag.lastX;
      const dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
      panByScreen(dx, dy);
    };

    const endDrag = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      try {
        el.releasePointerCapture(drag.pointerId);
      } catch {
        // already released — ignore
      }
      drag = null;
      el.classList.remove('grabbing');
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!Number.isFinite(event.deltaX) || !Number.isFinite(event.deltaY)) {
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        // ctrl/⌘+wheel and trackpad pinch both arrive here → zoom to cursor.
        const factor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
        zoomAtPoint(localPoint(event), factor);
      } else {
        // Plain wheel / two-finger scroll → pan (Figma/AFFiNE style).
        panByScreen(-event.deltaX, -event.deltaY);
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el.addEventListener('lostpointercapture', endDrag);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endDrag);
      el.removeEventListener('pointercancel', endDrag);
      el.removeEventListener('lostpointercapture', endDrag);
      el.removeEventListener('wheel', onWheel);
      if (drag) {
        try {
          el.releasePointerCapture(drag.pointerId);
        } catch {
          // ignore
        }
        drag = null;
        el.classList.remove('grabbing');
      }
    };
  }, [ref]);
}
