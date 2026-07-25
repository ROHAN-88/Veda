import { useEffect, useRef, useState } from 'react';
import { BackgroundGrid } from './BackgroundGrid';
import { CanvasHud } from './CanvasHud';
import { DebugCount } from './DebugCount';
import { DebugLayer } from './DebugLayer';
import { WorldLayer } from './WorldLayer';
import { usePanZoom } from '../hooks/usePanZoom';
import { useViewportStore } from '../store/viewportStore';

/**
 * The full-bleed whiteboard surface. Owns the container ref, wires pan/zoom,
 * feeds the measured size into the store via a ResizeObserver, and composes the
 * background grid, the transformed world layer, the HUD, and (in dev) the debug
 * overlay. The debug overlay is gated on `import.meta.env.DEV` AND a toggle, so
 * it is tree-shaken out of production builds.
 */
export function WhiteboardCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const setSize = useViewportStore((state) => state.setSize);
  const ready = useViewportStore((state) => state.size.width > 0);
  const [debugOn, setDebugOn] = useState(false);

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

  // `import.meta.env.DEV` is referenced DIRECTLY at each debug site (not via an
  // intermediate const) so the bundler folds the literal `false && …` and
  // tree-shakes DebugLayer/DebugCount/debugData out of production entirely.
  return (
    <div ref={containerRef} className="whiteboard">
      {ready && (
        <>
          <BackgroundGrid />
          <WorldLayer>{import.meta.env.DEV && debugOn && <DebugLayer />}</WorldLayer>
        </>
      )}
      <CanvasHud
        showDebugToggle={import.meta.env.DEV}
        debugOn={debugOn}
        onToggleDebug={() => setDebugOn((value) => !value)}
        debugSlot={import.meta.env.DEV && debugOn ? <DebugCount /> : null}
      />
    </div>
  );
}
