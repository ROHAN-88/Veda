import type { ReactNode } from 'react';
import { worldLayerTransform } from './coordinates';
import { useViewportStore } from '../store/viewportStore';

/**
 * The single CSS-transformed layer. Children are positioned in WORLD pixels
 * (CSS `left`/`top`), and this one transform maps them all to the screen.
 * Subscribes narrowly to `camera`/`size` so only this layer re-renders on pan.
 */
export function WorldLayer({ children }: { children?: ReactNode }) {
  const camera = useViewportStore((state) => state.camera);
  const size = useViewportStore((state) => state.size);
  return (
    <div className="whiteboard__world" style={{ transform: worldLayerTransform(camera, size) }}>
      {children}
    </div>
  );
}
