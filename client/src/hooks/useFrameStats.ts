import { useEffect, useState } from 'react';

/**
 * Rolling frames-per-second, resampled ~4×/sec via requestAnimationFrame. DEV-only
 * instrumentation for the debug HUD — mount it behind an `import.meta.env.DEV` gate
 * so it (and its rAF loop) tree-shakes out of the production bundle.
 */
export function useFrameStats(): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      frames += 1;
      const elapsed = now - last;
      if (elapsed >= 250) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return fps;
}
