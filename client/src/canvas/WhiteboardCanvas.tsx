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
import { useConnectionDraftStore } from '../store/connectionDraftStore';
import { useHistoryStore } from '../store/historyStore';
import { useSelectionStore } from '../store/selectionStore';
import { useToolStore } from '../store/toolStore';
import { useViewportStore } from '../store/viewportStore';

/**
 * The full-bleed whiteboard surface. Owns the container ref, wires pan/zoom,
 * marquee selection, and keyboard shortcuts, feeds the measured size into the
 * store, and composes the grid, world layer (cards + dev debug), the marquee
 * overlay, the HUD, and the selection toolbars. Cards are created via the HUD
 * "+ Card" button; the Select/Hand tools decide whether a left-drag marquee-selects
 * or pans (read-only always pans).
 */
export function WhiteboardCanvas({
  projectId,
  readOnly = false,
}: {
  projectId: string;
  readOnly?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setSize = useViewportStore((state) => state.setSize);
  const ready = useViewportStore((state) => state.size.width > 0);
  const tool = useToolStore((state) => state.tool);
  const [debugOn, setDebugOn] = useState(false);
  const { mutate: createCard } = useCreateCard(projectId);
  const { data: cards = [] } = useCards(projectId, { enabled: !readOnly });
  const { pushCreate } = useCardHistory(projectId);
  const panning = readOnly || tool === 'pan';

  usePanZoom(containerRef, readOnly); // Hand tool / read-only left-drag pans
  useMarquee(containerRef, projectId, readOnly);
  useCanvasKeyboard(projectId, readOnly); // Escape / Delete / arrows / Ctrl-A / undo-redo / V·H

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

  // The Hand tool deselects — cards are inert while it's active, so a lingering
  // selection (and its toolbar) would be confusing.
  useEffect(() => {
    if (tool === 'pan') {
      useSelectionStore.getState().clear();
      useConnectionDraftStore.getState().clear();
    }
  }, [tool]);

  const onAddCard = (): void => {
    const world = useViewportStore.getState().camera.center;
    createCard(
      { ...defaultCardBounds(world), color: defaultCardColor(cards.length) },
      { onSuccess: (card) => pushCreate(card.id) },
    );
  };

  return (
    <div ref={containerRef} className={`whiteboard${panning ? ' pan-mode' : ''}`}>
      {ready && (
        <>
          <BackgroundGrid />
          {/* Arrows paint under the cards but over the grid. */}
          <ConnectionsLayer projectId={projectId} readOnly={readOnly} />
          {!readOnly && <MarqueeOverlay />}
          <WorldLayer>
            <CardsLayer projectId={projectId} readOnly={readOnly} />
            {import.meta.env.DEV && debugOn && <DebugLayer />}
          </WorldLayer>
        </>
      )}
      <CanvasHud
        onAddCard={readOnly ? undefined : onAddCard}
        showTools={!readOnly}
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
      {!readOnly && <SelectionToolbar projectId={projectId} />}
      {!readOnly && <ConnectionToolbar projectId={projectId} />}
    </div>
  );
}
