import { useEffect, useRef, useState } from 'react';
import { BackgroundGrid } from './BackgroundGrid';
import { CanvasHud } from './CanvasHud';
import { CardsLayer } from './CardsLayer';
import { defaultCardBounds } from './cardGeometry';
import { defaultCardColor } from './cardShapes';
import { ConnectionsLayer } from './ConnectionsLayer';
import { ConnectionToolbar } from './ConnectionToolbar';
import { DebugCount } from './DebugCount';
import { DebugFps } from './DebugFps';
import { DebugLayer } from './DebugLayer';
import { MarqueeOverlay } from './MarqueeOverlay';
import { SelectionToolbar } from './SelectionToolbar';
import { WorldLayer } from './WorldLayer';
import { useCanvasKeyboard } from '../hooks/useCanvasKeyboard';
import { useCardHistory } from '../hooks/useCardHistory';
import { useCards, useCreateCard } from '../hooks/useCards';
import { useMarquee } from '../hooks/useMarquee';
import { usePanZoom } from '../hooks/usePanZoom';
import { useHistoryStore } from '../store/historyStore';
import { useViewportStore } from '../store/viewportStore';

/**
 * The full-bleed whiteboard surface. Owns the container ref, wires pan/zoom,
 * marquee selection, and keyboard shortcuts, feeds the measured size into the
 * store, and composes the grid, world layer (cards + dev debug), the marquee
 * overlay, the HUD, and the selection toolbars. Cards are created via the HUD
 * "+ Card" button; left-drag on empty canvas draws a selection marquee.
 */
export function WhiteboardCanvas({ projectId }: { projectId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setSize = useViewportStore((state) => state.setSize);
  const ready = useViewportStore((state) => state.size.width > 0);
  const [debugOn, setDebugOn] = useState(false);
  const { mutate: createCard } = useCreateCard(projectId);
  const { data: cards = [] } = useCards(projectId);
  const { pushCreate } = useCardHistory(projectId);

  usePanZoom(containerRef);
  useMarquee(containerRef, projectId);
  useCanvasKeyboard(projectId); // Escape / Delete / arrows / Ctrl-A / undo-redo / Space

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

  // History is session- AND project-scoped: dump it when the project changes.
  useEffect(() => useHistoryStore.getState().clear, [projectId]);

  const onAddCard = (): void => {
    const world = useViewportStore.getState().camera.center;
    createCard(
      { ...defaultCardBounds(world), color: defaultCardColor(cards.length) },
      { onSuccess: (card) => pushCreate(card.id) },
    );
  };

  return (
    <div ref={containerRef} className="whiteboard">
      {ready && (
        <>
          <BackgroundGrid />
          {/* Arrows paint under the cards but over the grid. */}
          <ConnectionsLayer projectId={projectId} />
          <MarqueeOverlay />
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
        debugSlot={
          import.meta.env.DEV && debugOn ? (
            <>
              <DebugCount />
              <DebugFps />
            </>
          ) : null
        }
      />
      <SelectionToolbar projectId={projectId} />
      <ConnectionToolbar projectId={projectId} />
    </div>
  );
}
