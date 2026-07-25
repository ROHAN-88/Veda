import { CELL_SIZE } from './constants';
import { DEMO_MARKERS } from './debugData';

// A fixed 7x7 block of cells around the origin, outlined to visualise the grid.
const CELL_INDEXES = [-3, -2, -1, 0, 1, 2, 3];

/**
 * Dev-only, world-space scene rendered INSIDE the WorldLayer. All positions are
 * world px; the parent's CSS transform maps them to the screen. Proves the
 * transforms: cells and markers stay anchored as the camera pans and zooms.
 */
export function DebugLayer() {
  return (
    <>
      {CELL_INDEXES.map((col) =>
        CELL_INDEXES.map((row) => (
          <div
            key={`${col}|${row}`}
            className="whiteboard__debug-cell"
            style={{
              left: col * CELL_SIZE,
              top: row * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
            }}
          />
        )),
      )}
      {DEMO_MARKERS.map((marker) => (
        <div
          key={marker.id}
          className="whiteboard__debug-marker"
          style={{
            left: marker.bounds.x,
            top: marker.bounds.y,
            width: marker.bounds.w,
            height: marker.bounds.h,
          }}
        >
          {marker.label}
        </div>
      ))}
    </>
  );
}
