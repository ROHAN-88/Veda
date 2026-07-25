import { SpatialGrid } from './SpatialGrid';
import type { Bounds } from './types';

export interface DemoMarker {
  id: string;
  bounds: Bounds;
  label: string;
}

/**
 * Fixed, non-persisted markers used ONLY by the dev debug overlay to prove the
 * transforms (they stay world-anchored under pan/zoom) and the spatial index
 * (they drop out of `search` once panned off-screen). Never shipped to prod —
 * this module is imported only by the dev-gated debug components.
 */
export const DEMO_MARKERS: DemoMarker[] = [
  { id: 'origin', bounds: { x: -60, y: -40, w: 120, h: 80 }, label: 'origin' },
  { id: 'north', bounds: { x: -60, y: -560, w: 120, h: 80 }, label: 'N' },
  { id: 'south', bounds: { x: -60, y: 480, w: 120, h: 80 }, label: 'S' },
  { id: 'east', bounds: { x: 500, y: -40, w: 120, h: 80 }, label: 'E' },
  { id: 'west', bounds: { x: -620, y: -40, w: 120, h: 80 }, label: 'W' },
  { id: 'far-ne', bounds: { x: 1400, y: -1400, w: 160, h: 100 }, label: 'far NE' },
  { id: 'far-sw', bounds: { x: -1560, y: 1300, w: 160, h: 100 }, label: 'far SW' },
  { id: 'far', bounds: { x: 3000, y: 2400, w: 200, h: 120 }, label: 'far' },
];

/**
 * Lazily-built spatial index over the demo markers. Built on first use rather
 * than at module load, so this module has NO top-level side effects and is
 * therefore fully tree-shaken from production once the dev-only debug components
 * that import it are stripped.
 */
let demoGrid: SpatialGrid | null = null;

export function getDemoGrid(): SpatialGrid {
  if (!demoGrid) {
    demoGrid = new SpatialGrid();
    for (const marker of DEMO_MARKERS) {
      demoGrid.insert(marker.id, marker.bounds);
    }
  }
  return demoGrid;
}
