/**
 * Pure screen <-> world coordinate transforms for the whiteboard camera.
 *
 * Conventions:
 * - `camera.center` is the WORLD point rendered at the CENTRE of the viewport.
 * - "local" coordinates are pixels relative to the canvas element's top-left
 *   (`clientX - rect.left`, `clientY - rect.top`).
 *
 * These functions are deliberately free of DOM/React so they can be unit-tested
 * in isolation and reused by both the store and the rendering components.
 */
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM } from './constants';
import type { Camera, Size, Vec2 } from './types';

/** True when both components are finite numbers. */
export function isFiniteVec(v: Vec2): boolean {
  return Number.isFinite(v.x) && Number.isFinite(v.y);
}

/** Clamp zoom into [MIN_ZOOM, MAX_ZOOM]; non-finite input falls back to default. */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return DEFAULT_ZOOM;
  }
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Screen (canvas-local px) -> world.
 * `world = center + (local - size/2) / zoom`
 */
export function screenToWorld(camera: Camera, size: Size, local: Vec2): Vec2 {
  return {
    x: camera.center.x + (local.x - size.width / 2) / camera.zoom,
    y: camera.center.y + (local.y - size.height / 2) / camera.zoom,
  };
}

/**
 * World -> screen (canvas-local px). Exact inverse of {@link screenToWorld}.
 * `local = (world - center) * zoom + size/2`
 */
export function worldToScreen(camera: Camera, size: Size, world: Vec2): Vec2 {
  return {
    x: (world.x - camera.center.x) * camera.zoom + size.width / 2,
    y: (world.y - camera.center.y) * camera.zoom + size.height / 2,
  };
}

/**
 * The CSS transform for the single world layer, assuming `transform-origin: 0 0`.
 * A child positioned (CSS `left/top`) at world (X,Y) then lands at
 * `(tx + X*zoom, ty + Y*zoom)`, which equals {@link worldToScreen} for every point.
 */
export function worldLayerTransform(camera: Camera, size: Size): string {
  const tx = size.width / 2 - camera.center.x * camera.zoom;
  const ty = size.height / 2 - camera.center.y * camera.zoom;
  return `translate(${tx}px, ${ty}px) scale(${camera.zoom})`;
}

/**
 * New camera centre such that the world point currently under `local` stays under
 * `local` at `nextZoom` — i.e. zoom-to-cursor. The anchor is resolved with the
 * *current* zoom BEFORE `nextZoom` is applied, so the invariant holds even when
 * `nextZoom` has been clamped at a zoom boundary.
 */
export function zoomToCursor(camera: Camera, size: Size, local: Vec2, nextZoom: number): Vec2 {
  const anchor = screenToWorld(camera, size, local);
  return {
    x: anchor.x - (local.x - size.width / 2) / nextZoom,
    y: anchor.y - (local.y - size.height / 2) / nextZoom,
  };
}
