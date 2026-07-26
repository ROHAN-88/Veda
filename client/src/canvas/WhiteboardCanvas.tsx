import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { BackgroundGrid } from './BackgroundGrid';
import { CanvasHud } from './CanvasHud';
import { CardsLayer } from './CardsLayer';
import { defaultCardBounds } from './cardGeometry';
import { defaultCardColor } from './cardShapes';
import { ConnectionsLayer } from './ConnectionsLayer';
import { ConnectionToolbar } from './ConnectionToolbar';
import { screenToWorld } from './coordinates';
import { DebugCount } from './DebugCount';
import { DebugLayer } from './DebugLayer';
import { SelectionToolbar } from './SelectionToolbar';
import { WorldLayer } from './WorldLayer';
import type { Vec2 } from './types';
import { useCards, useCreateCard } from '../hooks/useCards';
import { usePanZoom } from '../hooks/usePanZoom';
import { useConnectionDraftStore } from '../store/connectionDraftStore';
import { useSelectionStore } from '../store/selectionStore';
import { useViewportStore } from '../store/viewportStore';

/**
 * The full-bleed whiteboard surface. Owns the container ref, wires pan/zoom,
 * feeds the measured size into the store, and composes the grid, world layer
 * (cards + dev debug), the HUD, and the selection toolbar. Double-clicking empty
 * canvas creates a card under the cursor (its colour cycles the palette); a
 * pointer-down on empty canvas (or Escape) clears the selection.
 */
export function WhiteboardCanvas({ projectId }: { projectId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setSize = useViewportStore((state) => state.setSize);
  const ready = useViewportStore((state) => state.size.width > 0);
  const [debugOn, setDebugOn] = useState(false);
  const { mutate: createCard } = useCreateCard(projectId);
  const { data: cards = [] } = useCards(projectId);
  const clearSelection = useSelectionStore((state) => state.clear);

  usePanZoom(containerRef);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setSize]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        clearSelection();
        useConnectionDraftStore.getState().clear(); // cancel an in-progress arrow drag
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection]);

  const createAtWorld = (world: Vec2): void => {
    createCard({ ...defaultCardBounds(world), color: defaultCardColor(cards.length) });
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const local = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const { camera, size } = useViewportStore.getState();
    createAtWorld(screenToWorld(camera, size, local));
  };

  // Clears selection on empty canvas; a press on a card/handle/control stops
  // propagation or matches the allowlist, so this only fires on empty space.
  const onContainerPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const target = event.target as Element | null;
    if (!target || !target.closest('button, a, input, [data-no-pan]')) {
      clearSelection();
    }
  };

  const onAddCard = (): void => {
    createAtWorld(useViewportStore.getState().camera.center);
  };

  return (
    <div
      ref={containerRef}
      className="whiteboard"
      onPointerDown={onContainerPointerDown}
      onDoubleClick={onDoubleClick}
    >
      {ready && (
        <>
          <BackgroundGrid />
          {/* Arrows paint under the cards but over the grid. */}
          <ConnectionsLayer projectId={projectId} />
          <WorldLayer>
            <CardsLayer projectId={projectId} />
            {import.meta.env.DEV && debugOn && <DebugLayer />}
          </WorldLayer>
        </>
      )}
      <CanvasHud
        onAddCard={onAddCard}
        showDebugToggle={import.meta.env.DEV}
        debugOn={debugOn}
        onToggleDebug={() => setDebugOn((value) => !value)}
        debugSlot={import.meta.env.DEV && debugOn ? <DebugCount /> : null}
      />
      <SelectionToolbar projectId={projectId} />
      <ConnectionToolbar projectId={projectId} />
    </div>
  );
}
