/**
 * Viewport (camera) state for the whiteboard, held in Zustand rather than React
 * state: pan fires at pointermove rate and zoom at wheel rate (~120 Hz on
 * trackpads), and only the layers that subscribe (WorldLayer, BackgroundGrid)
 * should update — never the whole page subtree. The store also lives outside the
 * React tree, so it survives StrictMode's dev double-mount.
 *
 * All transform maths is delegated to `canvas/coordinates` so it stays pure and
 * unit-tested; the store only orchestrates and applies safety clamps.
 */
import { create } from 'zustand';
import { DEFAULT_ZOOM } from '../canvas/constants';
import { clampZoom, zoomToCursor } from '../canvas/coordinates';
import type { Camera, Size, Vec2 } from '../canvas/types';

interface ViewportState {
  camera: Camera;
  /** Measured container size in CSS px (from a ResizeObserver). */
  size: Size;
  setSize: (size: Size) => void;
  /** Pan by a screen-space delta (world delta = screen delta / zoom). */
  panByScreen: (dx: number, dy: number) => void;
  /** Zoom by `factor` about a canvas-local point, keeping that point anchored. */
  zoomAtPoint: (local: Vec2, factor: number) => void;
  /** Zoom by `factor` about the viewport centre (HUD +/-). */
  zoomAroundCenter: (factor: number) => void;
  /** Return to the origin at 100% zoom. */
  reset: () => void;
}

const INITIAL_CAMERA: Camera = { center: { x: 0, y: 0 }, zoom: DEFAULT_ZOOM };
const INITIAL_SIZE: Size = { width: 0, height: 0 };

export const useViewportStore = create<ViewportState>((set, get) => ({
  camera: INITIAL_CAMERA,
  size: INITIAL_SIZE,

  setSize: (size) => {
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
      return;
    }
    if (size.width < 0 || size.height < 0) {
      return;
    }
    set({ size });
  },

  panByScreen: (dx, dy) => {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return;
    }
    const { camera } = get();
    const nextCenter = {
      x: camera.center.x - dx / camera.zoom,
      y: camera.center.y - dy / camera.zoom,
    };
    if (!Number.isFinite(nextCenter.x) || !Number.isFinite(nextCenter.y)) {
      return;
    }
    set({ camera: { center: nextCenter, zoom: camera.zoom } });
  },

  zoomAtPoint: (local, factor) => {
    if (!Number.isFinite(factor) || factor <= 0) {
      return;
    }
    const { camera, size } = get();
    const nextZoom = clampZoom(camera.zoom * factor);
    const nextCenter = zoomToCursor(camera, size, local, nextZoom);
    if (!Number.isFinite(nextCenter.x) || !Number.isFinite(nextCenter.y)) {
      return;
    }
    set({ camera: { center: nextCenter, zoom: nextZoom } });
  },

  zoomAroundCenter: (factor) => {
    const { size } = get();
    get().zoomAtPoint({ x: size.width / 2, y: size.height / 2 }, factor);
  },

  reset: () => set({ camera: { center: { x: 0, y: 0 }, zoom: DEFAULT_ZOOM } }),
}));
