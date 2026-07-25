import type { ReactNode } from 'react';
import { ZOOM_STEP } from './constants';
import { useViewportStore } from '../store/viewportStore';

interface CanvasHudProps {
  showDebugToggle: boolean;
  debugOn: boolean;
  onToggleDebug: () => void;
  /** Optional dev-only readout rendered at the left of the HUD. */
  debugSlot?: ReactNode;
}

/** Floating controls: zoom %, zoom in/out (about centre), reset, debug toggle. */
export function CanvasHud({ showDebugToggle, debugOn, onToggleDebug, debugSlot }: CanvasHudProps) {
  const zoom = useViewportStore((state) => state.camera.zoom);
  const zoomAroundCenter = useViewportStore((state) => state.zoomAroundCenter);
  const reset = useViewportStore((state) => state.reset);

  return (
    <div className="whiteboard__hud">
      {debugSlot}
      {showDebugToggle && (
        <button className="ghost" onClick={onToggleDebug} aria-pressed={debugOn}>
          {debugOn ? 'Debug: on' : 'Debug'}
        </button>
      )}
      <button
        className="ghost"
        onClick={() => zoomAroundCenter(1 / ZOOM_STEP)}
        aria-label="Zoom out"
      >
        −
      </button>
      <span className="whiteboard__zoom" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button className="ghost" onClick={() => zoomAroundCenter(ZOOM_STEP)} aria-label="Zoom in">
        +
      </button>
      <button className="ghost" onClick={reset}>
        Reset view
      </button>
    </div>
  );
}
