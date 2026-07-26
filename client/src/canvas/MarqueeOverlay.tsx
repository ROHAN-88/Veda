import { useMarqueeStore } from '../store/marqueeStore';

/**
 * The rubber-band selection box — a screen-space `<div>` (sibling of the arrows
 * layer) drawn from the two marquee corners. Purely visual; the hit-test lives in
 * `useMarquee`.
 */
export function MarqueeOverlay() {
  const start = useMarqueeStore((state) => state.start);
  const current = useMarqueeStore((state) => state.current);
  if (!start || !current) {
    return null;
  }
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const width = Math.abs(start.x - current.x);
  const height = Math.abs(start.y - current.y);
  return (
    <div className="whiteboard__marquee" style={{ left, top, width, height }} aria-hidden="true" />
  );
}
