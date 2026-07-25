import { CELL_SIZE, GRID_LINE_COLOR } from './constants';
import { worldToScreen } from './coordinates';
import { useViewportStore } from '../store/viewportStore';

/**
 * Pure-visual grid drawn with CSS gradients on a NON-transformed layer, so lines
 * stay crisp at 1px at every zoom. `backgroundSize` scales with zoom and
 * `backgroundPosition` tracks the world origin, so the grid moves with the camera.
 */
export function BackgroundGrid() {
  const camera = useViewportStore((state) => state.camera);
  const size = useViewportStore((state) => state.size);

  const step = CELL_SIZE * camera.zoom;
  const origin = worldToScreen(camera, size, { x: 0, y: 0 });
  // Anchor the repeating pattern to the world origin; modulo keeps it bounded.
  const posX = ((origin.x % step) + step) % step;
  const posY = ((origin.y % step) + step) % step;

  return (
    <div
      className="whiteboard__grid"
      aria-hidden="true"
      style={{
        backgroundImage: `linear-gradient(to right, ${GRID_LINE_COLOR} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_LINE_COLOR} 1px, transparent 1px)`,
        backgroundSize: `${step}px ${step}px`,
        backgroundPosition: `${posX}px ${posY}px`,
      }}
    />
  );
}
