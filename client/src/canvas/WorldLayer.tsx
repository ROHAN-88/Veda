import type { CSSProperties, ReactNode } from 'react';
import { worldLayerTransform } from './coordinates';
import { useViewportStore } from '../store/viewportStore';

/**
 * The single CSS-transformed layer. Children are positioned in WORLD pixels
 * (CSS `left`/`top`), and this one transform maps them all to the screen.
 * Subscribes narrowly to `camera`/`size` so only this layer re-renders on pan.
 *
 * Also publishes `--inv-zoom` (= 1 / zoom): selection handles and connect ports
 * consume it to counter-scale, so they stay a constant SCREEN size/distance at
 * any zoom instead of growing with the `scale(zoom)` transform.
 */
export function WorldLayer({ children }: { children?: ReactNode }) {
  const camera = useViewportStore((state) => state.camera);
  const size = useViewportStore((state) => state.size);
  const style = {
    transform: worldLayerTransform(camera, size),
    '--inv-zoom': 1 / camera.zoom,
  } as CSSProperties;
  return (
    <div className="whiteboard__world" style={style}>
      {children}
    </div>
  );
}
