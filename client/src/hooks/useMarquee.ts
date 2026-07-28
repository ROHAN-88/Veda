import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { cardsInRect, rectFromCorners } from '../canvas/cardsInRect';
import { screenToWorld } from '../canvas/coordinates';
import type { Card } from '../api/types';
import { cardsKey } from './useCards';
import { useMarqueeStore } from '../store/marqueeStore';
import { useSelectionStore } from '../store/selectionStore';
import { useToolStore } from '../store/toolStore';
import { useViewportStore } from '../store/viewportStore';

/**
 * Rubber-band marquee selection (Phase 8), wired with native listeners on the
 * canvas container (like usePanZoom). Active only with the Select tool: a left-drag
 * over empty canvas draws the box and live-selects the intersecting cards; Shift
 * keeps the prior selection (additive); a plain left-press clears the selection.
 * The Hand tool pans instead (usePanZoom), so the two are mutually excluded.
 */
export function useMarquee<T extends HTMLElement>(
  ref: RefObject<T | null>,
  projectId: string,
  readOnly = false,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const el = ref.current;
    if (!el || readOnly) {
      return; // read-only share view has no selection
    }
    const marquee = useMarqueeStore.getState();
    let active: { pointerId: number; base: string[]; additive: boolean } | null = null;

    const localPoint = (event: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || useToolStore.getState().tool !== 'select') {
        return; // left-only, and only with the Select tool (Hand tool pans)
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
  }, [ref, projectId, queryClient, readOnly]);
}
