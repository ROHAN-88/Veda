import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardImageBlock } from './CardImageBlock';

/**
 * Static render only (node env — no DOM). `useImageResize` touches `window` and the
 * viewport store solely inside event handlers, and its one effect is cleanup-only, so
 * server rendering is safe. The gesture itself can't be covered here; all of its
 * arithmetic lives in `imageSize.ts` and is unit-tested there.
 */
const IMG = '/api/uploads/8f3e0c2a-0000-4000-8000-000000000001';
const noop = (): void => {};

describe('CardImageBlock', () => {
  it('renders a resize grip when resizing is allowed', () => {
    const html = renderToStaticMarkup(
      <CardImageBlock src={IMG} alt="shot" onRemove={noop} onResize={noop} />,
    );
    expect(html).toContain('aria-label="Resize image"');
    expect(html).toContain('aria-label="Remove image"');
  });

  // The share-view contract: unresizable is not the same as unsized.
  it('honours a stored width but renders no grip without onResize', () => {
    const html = renderToStaticMarkup(
      <CardImageBlock src={IMG} alt="shot" width={320} onRemove={noop} />,
    );
    expect(html).not.toContain('aria-label="Resize image"');
    expect(html).toContain('style="width:320px"');
    expect(html).toContain('sized');
  });

  it('leaves an unsized image with no width and no sized class', () => {
    const html = renderToStaticMarkup(
      <CardImageBlock src={IMG} alt="shot" onRemove={noop} onResize={noop} />,
    );
    expect(html).not.toContain('style=');
    expect(html).not.toContain('sized');
  });
});
