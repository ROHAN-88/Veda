import { screenToWorld } from './coordinates';
import { DEMO_MARKERS, getDemoGrid } from './debugData';
import { useViewportStore } from '../store/viewportStore';

/**
 * Dev-only HUD readout: how many demo markers fall within the current viewport,
 * via `SpatialGrid.search` over the viewport's world rect. Panning a marker out
 * of view decrements the count — a live proof that culling works.
 */
export function DebugCount() {
  const camera = useViewportStore((state) => state.camera);
  const size = useViewportStore((state) => state.size);

  const topLeft = screenToWorld(camera, size, { x: 0, y: 0 });
  const bottomRight = screenToWorld(camera, size, { x: size.width, y: size.height });
  const visible = getDemoGrid().search({
    x: topLeft.x,
    y: topLeft.y,
    w: bottomRight.x - topLeft.x,
    h: bottomRight.y - topLeft.y,
  }).size;

  return (
    <span className="whiteboard__hud-info">
      {visible} / {DEMO_MARKERS.length} markers in view
    </span>
  );
}
