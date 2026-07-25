import { describe, expect, it } from 'vitest';
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM } from './constants';
import {
  clampZoom,
  screenToWorld,
  worldLayerTransform,
  worldToScreen,
  zoomToCursor,
} from './coordinates';
import type { Camera, Size } from './types';

const SIZE: Size = { width: 800, height: 600 };

const cameras: Camera[] = [
  { center: { x: 0, y: 0 }, zoom: 1 },
  { center: { x: 123, y: -77 }, zoom: 0.1 },
  { center: { x: -1000, y: 2500 }, zoom: 6 },
  { center: { x: 42.5, y: 42.5 }, zoom: 2.3 },
];

describe('coordinates transforms', () => {
  it('round-trips screen -> world -> screen', () => {
    const locals = [
      { x: 0, y: 0 },
      { x: 400, y: 300 },
      { x: 800, y: 600 },
      { x: 137, y: 512 },
    ];
    for (const camera of cameras) {
      for (const local of locals) {
        const back = worldToScreen(camera, SIZE, screenToWorld(camera, SIZE, local));
        expect(back.x).toBeCloseTo(local.x, 6);
        expect(back.y).toBeCloseTo(local.y, 6);
      }
    }
  });

  it('round-trips world -> screen -> world', () => {
    const worlds = [
      { x: 0, y: 0 },
      { x: 250, y: -180 },
      { x: -999, y: 1234 },
    ];
    for (const camera of cameras) {
      for (const world of worlds) {
        const back = screenToWorld(camera, SIZE, worldToScreen(camera, SIZE, world));
        expect(back.x).toBeCloseTo(world.x, 6);
        expect(back.y).toBeCloseTo(world.y, 6);
      }
    }
  });

  it('maps camera.center to the viewport centre and back', () => {
    for (const camera of cameras) {
      const screen = worldToScreen(camera, SIZE, camera.center);
      expect(screen.x).toBeCloseTo(SIZE.width / 2, 6);
      expect(screen.y).toBeCloseTo(SIZE.height / 2, 6);

      const world = screenToWorld(camera, SIZE, { x: SIZE.width / 2, y: SIZE.height / 2 });
      expect(world.x).toBeCloseTo(camera.center.x, 6);
      expect(world.y).toBeCloseTo(camera.center.y, 6);
    }
  });

  it('builds the world-layer CSS transform (transform-origin 0 0)', () => {
    const camera: Camera = { center: { x: 10, y: 20 }, zoom: 2 };
    expect(worldLayerTransform(camera, SIZE)).toBe('translate(380px, 260px) scale(2)');
  });

  it('clamps zoom and rejects non-finite input', () => {
    expect(clampZoom(0.001)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(2.5)).toBe(2.5);
    expect(clampZoom(MIN_ZOOM)).toBe(MIN_ZOOM);
    expect(clampZoom(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(DEFAULT_ZOOM);
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(DEFAULT_ZOOM);
  });

  it('keeps the cursor anchored when zooming (in, out, and at both bounds)', () => {
    const camera: Camera = { center: { x: 30, y: -15 }, zoom: 1 };
    const local = { x: 620, y: 210 };
    const anchor = screenToWorld(camera, SIZE, local);
    const nextZooms = [clampZoom(2), clampZoom(0.5), MIN_ZOOM, MAX_ZOOM];
    for (const nextZoom of nextZooms) {
      const center = zoomToCursor(camera, SIZE, local, nextZoom);
      const screen = worldToScreen({ center, zoom: nextZoom }, SIZE, anchor);
      expect(screen.x).toBeCloseTo(local.x, 6);
      expect(screen.y).toBeCloseTo(local.y, 6);
    }
  });

  it('pan by a screen delta shifts a fixed world point by the same delta', () => {
    const camera: Camera = { center: { x: 5, y: 5 }, zoom: 2 };
    const dx = 40;
    const dy = -25;
    // panByScreen(dx, dy) is: center -= delta / zoom
    const panned: Camera = {
      center: { x: camera.center.x - dx / camera.zoom, y: camera.center.y - dy / camera.zoom },
      zoom: camera.zoom,
    };
    const point = { x: 111, y: -222 };
    const before = worldToScreen(camera, SIZE, point);
    const after = worldToScreen(panned, SIZE, point);
    expect(after.x - before.x).toBeCloseTo(dx, 6);
    expect(after.y - before.y).toBeCloseTo(dy, 6);
  });
});
