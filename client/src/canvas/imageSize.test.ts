import { describe, expect, it } from 'vitest';
import { IMAGE_WIDTH_MAX, IMAGE_WIDTH_MIN } from './constants';
import {
  imageMarkdown,
  imageResizeBounds,
  parseDestinationWidth,
  parseImageWidth,
  resizeImageWidth,
} from './imageSize';

const IMG = '/api/uploads/8f3e0c2a-0000-4000-8000-000000000001';

describe('parseImageWidth', () => {
  it('reads a width in the exact grammar', () => {
    expect(parseImageWidth('w=320')).toBe(320);
    expect(parseImageWidth(`w=${IMAGE_WIDTH_MIN}`)).toBe(IMAGE_WIDTH_MIN);
    expect(parseImageWidth(`w=${IMAGE_WIDTH_MAX}`)).toBe(IMAGE_WIDTH_MAX);
  });

  it('rejects values outside the range rather than clamping them', () => {
    expect(parseImageWidth('w=10')).toBeUndefined(); // below IMAGE_WIDTH_MIN
    expect(parseImageWidth('w=9999')).toBeUndefined(); // above IMAGE_WIDTH_MAX
  });

  // A human-authored title must stay a title — this is what makes the format safe.
  it.each([
    'w=320px',
    'W=320',
    'w = 320',
    ' w=320',
    'w=320 ',
    'w=3',
    'w=32.5',
    'w=-320',
    'My holiday photo',
    '320',
    '',
  ])('treats %j as an ordinary title', (title) => {
    expect(parseImageWidth(title)).toBeUndefined();
  });

  it('handles a missing title', () => {
    expect(parseImageWidth(null)).toBeUndefined();
    expect(parseImageWidth(undefined)).toBeUndefined();
  });
});

describe('parseDestinationWidth', () => {
  it('accepts all three CommonMark title delimiters', () => {
    expect(parseDestinationWidth(`${IMG} "w=320"`)).toBe(320);
    expect(parseDestinationWidth(`${IMG} 'w=320'`)).toBe(320);
    expect(parseDestinationWidth(`${IMG} (w=320)`)).toBe(320);
  });

  it('tolerates extra whitespace around the title', () => {
    expect(parseDestinationWidth(`  ${IMG}   "w=320"  `)).toBe(320);
  });

  it('returns undefined for a bare destination', () => {
    expect(parseDestinationWidth(IMG)).toBeUndefined();
  });

  it('returns undefined for a foreign or unquoted title', () => {
    expect(parseDestinationWidth(`${IMG} "Some caption"`)).toBeUndefined();
    expect(parseDestinationWidth(`${IMG} w=320`)).toBeUndefined();
  });
});

describe('imageMarkdown', () => {
  // The byte-identity guarantee: an unsized image must serialise exactly as the app
  // has always written it, so existing cards never change.
  it('emits no title when there is no width', () => {
    expect(imageMarkdown(IMG, '')).toBe(`![](${IMG})`);
    expect(imageMarkdown(IMG, 'shot')).toBe(`![shot](${IMG})`);
    expect(imageMarkdown(IMG, '', undefined)).toBe(`![](${IMG})`);
  });

  it('emits a double-quoted title when there is one', () => {
    expect(imageMarkdown(IMG, 'shot', 320)).toBe(`![shot](${IMG} "w=320")`);
  });

  it('rounds a fractional width', () => {
    expect(imageMarkdown(IMG, '', 319.6)).toBe(`![](${IMG} "w=320")`);
  });

  it('drops an unusable width rather than emitting a line that will not re-parse', () => {
    expect(imageMarkdown(IMG, '', 5)).toBe(`![](${IMG})`);
    expect(imageMarkdown(IMG, '', 99_999)).toBe(`![](${IMG})`);
    expect(imageMarkdown(IMG, '', Number.NaN)).toBe(`![](${IMG})`);
  });

  it.each([IMAGE_WIDTH_MIN, 64, 320, 1024, IMAGE_WIDTH_MAX])(
    'round-trips a width of %i',
    (width) => {
      const line = imageMarkdown(IMG, 'alt', width);
      const destination = line.slice(line.indexOf('(') + 1, -1);
      expect(parseDestinationWidth(destination)).toBe(width);
    },
  );
});

describe('resizeImageWidth', () => {
  const NO_ROTATION = 0;
  const at = (dx: number, dy = 0) => ({ dx, dy });

  it('grows on a rightward drag and shrinks on a leftward one', () => {
    expect(resizeImageWidth(200, at(50), 1, NO_ROTATION)).toBe(250);
    expect(resizeImageWidth(200, at(-50), 1, NO_ROTATION)).toBe(150);
  });

  it('divides the screen delta by zoom to reach world px', () => {
    expect(resizeImageWidth(200, at(100), 2, NO_ROTATION)).toBe(250);
    expect(resizeImageWidth(200, at(100), 0.5, NO_ROTATION)).toBe(400);
  });

  it('clamps to the default bounds', () => {
    expect(resizeImageWidth(100, at(-9999), 1, NO_ROTATION)).toBe(IMAGE_WIDTH_MIN);
    expect(resizeImageWidth(100, at(99_999), 1, NO_ROTATION)).toBe(IMAGE_WIDTH_MAX);
  });

  it('honours a caller-supplied max (the container width)', () => {
    expect(resizeImageWidth(200, at(9999), 1, NO_ROTATION, { max: 300 })).toBe(300);
  });

  it('does not invert the range when max is below min', () => {
    // A card narrower than IMAGE_WIDTH_MIN — the clamp must still resolve.
    expect(resizeImageWidth(200, at(-9999), 1, NO_ROTATION, { max: 10 })).toBe(IMAGE_WIDTH_MIN);
  });

  // Mirrors cardResize's rotated-card coverage: the gesture works in the card's axes.
  it('rotates the delta into the card local axes', () => {
    expect(resizeImageWidth(200, at(0, 50), 1, 90)).toBe(250);
    expect(resizeImageWidth(200, at(50, 0), 1, 90)).toBe(200);
    expect(resizeImageWidth(200, at(-50), 1, 180)).toBe(250);
  });

  it('always returns a whole number', () => {
    expect(Number.isInteger(resizeImageWidth(200, at(33), 3, NO_ROTATION))).toBe(true);
  });

  it('survives a degenerate zoom without producing NaN', () => {
    expect(resizeImageWidth(200, at(50), 0, NO_ROTATION)).toBe(250);
  });
});

describe('imageResizeBounds', () => {
  it('starts from the rendered width and grows to the container width', () => {
    expect(imageResizeBounds(200, 600)).toEqual({ width: 200, max: 600 });
  });

  // The regression this function exists for: the element being measured was the
  // `fit-content` box that HUGS the image, so max === width and every rightward drag
  // clamped straight back to the start width — the grip looked dead.
  it('lets a rightward drag actually reach the container width', () => {
    const start = imageResizeBounds(200, 600) ?? { width: 0, max: 0 };
    expect(resizeImageWidth(start.width, { dx: 9999, dy: 0 }, 1, 0, { max: start.max })).toBe(600);
  });

  it('refuses the gesture before the image is laid out', () => {
    expect(imageResizeBounds(0, 600)).toBeNull();
    expect(imageResizeBounds(Number.NaN, 600)).toBeNull();
  });

  // An unmeasurable container must not freeze the grip — CSS `max-width: 100%` still
  // stops the image visually overflowing its card.
  it('falls back to the absolute cap when no container could be measured', () => {
    expect(imageResizeBounds(200, null)).toEqual({ width: 200, max: IMAGE_WIDTH_MAX });
    expect(imageResizeBounds(200, 0)).toEqual({ width: 200, max: IMAGE_WIDTH_MAX });
  });

  // A card may be SIZE_MAX (10 000) world px wide, but `imageMarkdown` DROPS a width the
  // four-digit `w=` grammar cannot express, so an uncapped drag would commit nothing.
  it('never exceeds the serialisable cap, however wide the card', () => {
    expect(imageResizeBounds(200, 9000)?.max).toBe(IMAGE_WIDTH_MAX);
  });

  // Otherwise the first pointer event clamps DOWN and a click-without-drag shrinks it.
  it('never reports a max below the width already on screen', () => {
    expect(imageResizeBounds(200, 120)).toEqual({ width: 200, max: 200 });
  });
});
