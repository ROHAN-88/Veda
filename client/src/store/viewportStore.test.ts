import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM } from '../canvas/constants';
import { worldToScreen } from '../canvas/coordinates';
import { useViewportStore } from './viewportStore';

// Snapshot the pristine initial state (incl. action fns) before any test mutates,
// then restore it before each test for a fresh, isolated store.
const INITIAL = useViewportStore.getState();

describe('viewportStore', () => {
  beforeEach(() => {
    useViewportStore.setState(INITIAL, true);
  });

  it('starts centred at the origin at 100% zoom with unmeasured size', () => {
    const { camera, size } = useViewportStore.getState();
    expect(camera).toEqual({ center: { x: 0, y: 0 }, zoom: 1 });
    expect(size).toEqual({ width: 0, height: 0 });
  });

  it('pans by a screen delta (center -= delta / zoom)', () => {
    useViewportStore.setState({ camera: { center: { x: 0, y: 0 }, zoom: 2 } });
    useViewportStore.getState().panByScreen(40, -20);
    expect(useViewportStore.getState().camera.center).toEqual({ x: -20, y: 10 });
  });

  it('zooms about a point while keeping that point anchored', () => {
    useViewportStore.setState({
      camera: { center: { x: 0, y: 0 }, zoom: 1 },
      size: { width: 800, height: 600 },
    });
    const local = { x: 600, y: 300 };
    useViewportStore.getState().zoomAtPoint(local, 2);
    const { camera, size } = useViewportStore.getState();
    expect(camera.zoom).toBe(2);
    const screen = worldToScreen(camera, size, { x: 200, y: 0 }); // the anchored world point
    expect(screen.x).toBeCloseTo(local.x, 6);
    expect(screen.y).toBeCloseTo(local.y, 6);
  });

  it('clamps zoom at the MAX bound', () => {
    useViewportStore.setState({
      camera: { center: { x: 0, y: 0 }, zoom: 5 },
      size: { width: 800, height: 600 },
    });
    useViewportStore.getState().zoomAtPoint({ x: 400, y: 300 }, 4); // 5*4 -> clamp
    expect(useViewportStore.getState().camera.zoom).toBe(MAX_ZOOM);
  });

  it('zooms about the viewport centre without moving the centre', () => {
    useViewportStore.setState({
      camera: { center: { x: 17, y: -9 }, zoom: 1 },
      size: { width: 800, height: 600 },
    });
    useViewportStore.getState().zoomAroundCenter(3);
    const { camera } = useViewportStore.getState();
    expect(camera.zoom).toBe(3);
    expect(camera.center.x).toBeCloseTo(17, 6);
    expect(camera.center.y).toBeCloseTo(-9, 6);
  });

  it('clamps zoomAroundCenter at the MIN bound', () => {
    useViewportStore.setState({
      camera: { center: { x: 0, y: 0 }, zoom: 0.2 },
      size: { width: 800, height: 600 },
    });
    useViewportStore.getState().zoomAroundCenter(0.1); // 0.02 -> clamp to MIN
    expect(useViewportStore.getState().camera.zoom).toBe(MIN_ZOOM);
  });

  it('reset() returns to origin / 100%', () => {
    useViewportStore.setState({ camera: { center: { x: 500, y: 500 }, zoom: 4 } });
    useViewportStore.getState().reset();
    expect(useViewportStore.getState().camera).toEqual({ center: { x: 0, y: 0 }, zoom: 1 });
  });

  it('ignores non-finite pan deltas and invalid sizes', () => {
    useViewportStore.setState({
      camera: { center: { x: 3, y: 4 }, zoom: 1 },
      size: { width: 800, height: 600 },
    });
    useViewportStore.getState().panByScreen(Number.NaN, 10);
    expect(useViewportStore.getState().camera.center).toEqual({ x: 3, y: 4 });
    useViewportStore.getState().setSize({ width: Number.POSITIVE_INFINITY, height: 100 });
    expect(useViewportStore.getState().size).toEqual({ width: 800, height: 600 });
    useViewportStore.getState().setSize({ width: -5, height: 100 });
    expect(useViewportStore.getState().size).toEqual({ width: 800, height: 600 });
  });
});
