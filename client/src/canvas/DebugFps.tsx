import { useFrameStats } from '../hooks/useFrameStats';

/** Dev-only HUD readout: rolling FPS, to validate the render/perf pass. */
export function DebugFps() {
  const fps = useFrameStats();
  return <span className="whiteboard__hud-info">{fps} fps</span>;
}
