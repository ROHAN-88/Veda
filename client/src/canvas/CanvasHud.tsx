import type { ReactNode } from 'react';
import { CanvasToolSwitch } from './CanvasToolSwitch';
import { ZOOM_STEP } from './constants';
import { useViewportStore } from '../store/viewportStore';

interface CanvasHudProps {
  showDebugToggle: boolean;
  debugOn: boolean;
  onToggleDebug: () => void;
  /** Create a card at the viewport centre. Omit to hide the button (read-only view). */
  onAddCard?: () => void;
  /** Show the Select / Hand tool switch (hidden in the read-only share view). */
  showTools?: boolean;
  /** Optional dev-only readout rendered at the left of the HUD. */
  debugSlot?: ReactNode;
}

/** Floating controls: tool switch, add card, zoom %, zoom in/out, reset, debug. */
export function CanvasHud({
  showDebugToggle,
  debugOn,
  onToggleDebug,
  onAddCard,
  showTools,
  debugSlot,
}: CanvasHudProps) {
  const zoom = useViewportStore((state) => state.camera.zoom);
  const zoomAroundCenter = useViewportStore((state) => state.zoomAroundCenter);
  const reset = useViewportStore((state) => state.reset);

  return (
    <div className="whiteboard__hud" data-no-pan>
      {debugSlot}
      {showTools && <CanvasToolSwitch />}
      {onAddCard && <button onClick={onAddCard}>+ Card</button>}
      <span className="whiteboard__hud-divider" aria-hidden="true" />
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
