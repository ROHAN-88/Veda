import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Handle } from './cardResize';

const RESIZE_HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
/** Edge midpoints that carry a connect port (start of a relation arrow). */
const PORTS = ['n', 'e', 's', 'w'] as const;

interface CardHandlesProps {
  onResize: (handle: Handle, event: ReactPointerEvent<HTMLDivElement>) => void;
  onRotate: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onConnectStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/**
 * Selection outline + 8 resize squares + 1 rotate circle + 4 connect ports.
 * Each is `data-no-pan` so it never pans the canvas or clears the selection.
 * Dragging from a port starts a relation arrow (handled by the parent).
 */
export function CardHandles({ onResize, onRotate, onConnectStart }: CardHandlesProps) {
  return (
    <>
      <div className="whiteboard__card-selection" aria-hidden="true" />
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          className={`whiteboard__resize-handle handle-${handle}`}
          data-no-pan
          onPointerDown={(event) => onResize(handle, event)}
        />
      ))}
      <div
        className="whiteboard__rotate-handle"
        data-no-pan
        aria-label="Rotate card"
        onPointerDown={onRotate}
      />
      {PORTS.map((port) => (
        <div
          key={port}
          className={`whiteboard__connect-port port-${port}`}
          data-no-pan
          role="button"
          aria-label="Drag to connect"
          onPointerDown={onConnectStart}
        />
      ))}
    </>
  );
}
