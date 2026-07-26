import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { cardsInRect, rectFromCorners } from '../canvas/cardsInRect';
import { screenToWorld } from '../canvas/coordinates';
import type { Card } from '../api/types';
import { cardsKey } from './useCards';
import { useMarqueeStore } from '../store/marqueeStore';
import { usePanModeStore } from '../store/panModeStore';
import { useSelectionStore } from '../store/selectionStore';
import { useViewportStore } from '../store/viewportStore';

/**
 * Rubber-band marquee selection (Phase 8), wired with native listeners on the
 * canvas container (like usePanZoom). A left-drag over empty canvas (no Space)
 * draws the box and live-selects the intersecting cards; Shift keeps the prior
 * selection (additive). A plain left-press clears the selection. Panning
 * (middle-drag / Space+left) is handled by usePanZoom and mutually excluded here.
 */
export function useMarquee<T extends HTMLElement>(
  ref: RefObject<T | null>,
  projectId: string,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const marquee = useMarqueeStore.getState();
    let active: { pointerId: number; base: string[]; additive: boolean } | null = null;

    const localPoint = (event: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || usePanModeStore.getState().spaceHeld) {
        return; // left-only, and not while panning
      }
      const target = event.target as Element | null;
      if (target && target.closest('button, a, input, [data-no-pan]')) {
        return; // empty canvas only (cards/handles/toolbars carry data-no-pan)
      }
      const selection = useSelectionStore.getState();
      const additive = event.shiftKey;
      const base = additive ? [...selection.selectedIds] : [];
      if (!additive) {
        selection.clear(); // a plain empty-canvas press deselects
      }
      active = { pointerId: event.pointerId, base, additive };
      marquee.begin(localPoint(event));
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // stale pointer id — ignore
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) {
        return;
      }
      const point = localPoint(event);
      marquee.move(point);
      const start = useMarqueeStore.getState().start;
      if (!start) {
        return;
      }
      const { camera, size } = useViewportStore.getState();
      const rect = rectFromCorners(
        screenToWorld(camera, size, start),
        screenToWorld(camera, size, point),
      );
      const cards = queryClient.getQueryData<Card[]>(cardsKey(projectId)) ?? [];
      const ids = cardsInRect(cards, rect);
      useSelectionStore.getState().selectMany(active.additive ? [...active.base, ...ids] : ids);
    };

    const end = (event: PointerEvent) => {
      if (!active || event.pointerId !== active.pointerId) {
        return;
      }
      try {
        el.releasePointerCapture(active.pointerId);
      } catch {
        // already released — ignore
      }
      active = null;
      useMarqueeStore.getState().clear();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      el.removeEventListener('lostpointercapture', end);
      if (active) {
        useMarqueeStore.getState().clear();
      }
    };
  }, [ref, projectId, queryClient]);
}
