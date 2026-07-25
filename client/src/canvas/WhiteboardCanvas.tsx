import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { BackgroundGrid } from './BackgroundGrid';
import { CanvasHud } from './CanvasHud';
import { CardsLayer } from './CardsLayer';
import { defaultCardBounds } from './cardGeometry';
import { screenToWorld } from './coordinates';
import { DebugCount } from './DebugCount';
import { DebugLayer } from './DebugLayer';
import { WorldLayer } from './WorldLayer';
import type { Vec2 } from './types';
import { useCreateCard } from '../hooks/useCards';
import { usePanZoom } from '../hooks/usePanZoom';
import { useViewportStore } from '../store/viewportStore';

/**
 * The full-bleed whiteboard surface. Owns the container ref, wires pan/zoom,
 * feeds the measured size into the store via a ResizeObserver, and composes the
 * background grid, the transformed world layer (cards + dev debug overlay), and
 * the HUD. Double-clicking empty canvas creates a card under the cursor; the HUD
 * "+ Card" creates one at the viewport centre.
 */
export function WhiteboardCanvas({ projectId }: { projectId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setSize = useViewportStore((state) => state.setSize);
  const ready = useViewportStore((state) => state.size.width > 0);
  const [debugOn, setDebugOn] = useState(false);
  const { mutate: createCard } = useCreateCard(projectId);

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

  const createAtWorld = (world: Vec2): void => {
    createCard(defaultCardBounds(world));
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

  const onAddCard = (): void => {
    createAtWorld(useViewportStore.getState().camera.center);
  };

  // `import.meta.env.DEV` is referenced DIRECTLY at each debug site so the bundler
  // folds `false && …` and tree-shakes the dev overlay out of production.
  return (
    <div ref={containerRef} className="whiteboard" onDoubleClick={onDoubleClick}>
      {ready && (
        <>
          <BackgroundGrid />
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
    </div>
  );
}
