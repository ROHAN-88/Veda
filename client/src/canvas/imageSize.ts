/**
 * Explicit per-image sizing for card images — the Markdown format and the drag math.
 * Pure: no DOM, no React (same split as `cardResize.ts`).
 *
 * An image the user has resized carries its width in the Markdown TITLE slot:
 *
 *     ![alt](/api/uploads/8f3e0c2a-… "w=320")
 *
 * The title is an annotation, so `src` keeps being exactly the upload URL — which
 * matters because `removeImageBySrc`, the editor's React keys, and anything else that
 * asks "which upload is this" all compare on `src`. An image that has NEVER been
 * resized carries no title at all and serialises byte-identically to `![](src)`, so
 * existing cards are untouched and keep the CSS default cap (`max-height: 8em`).
 *
 * Width only, never height: with `height: auto` the browser re-derives the height
 * from the USED width, so the aspect ratio survives even when `max-width: 100%`
 * clamps the image inside a narrow card. One number, one drag axis, no aspect drift.
 */
import { IMAGE_WIDTH_MAX, IMAGE_WIDTH_MIN } from './constants';

/**
 * The whole grammar. `\d{2,4}` is deliberate: the pattern itself cannot express a
 * value outside [10, 9999], so parsing and clamping can never disagree by more than
 * the range check below. Integers only — sub-pixel widths are meaningless and would
 * let 1px of pointer jitter rewrite `card.content`.
 */
const SIZE_TITLE = /^w=(\d{2,4})$/;

/** CommonMark's three title delimiters. We READ all three (react-markdown accepts
 *  them all, so a hand-typed `'w=320'` must not render differently in the editor)
 *  but only ever WRITE double quotes. */
const TITLE_DELIMITERS: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'],
  ["'", "'"],
  ['(', ')'],
];

const inRange = (width: number): boolean => width >= IMAGE_WIDTH_MIN && width <= IMAGE_WIDTH_MAX;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Strip one layer of title delimiters, or null if `value` isn't a quoted title. */
function unwrapTitle(value: string): string | null {
  for (const [open, close] of TITLE_DELIMITERS) {
    if (value.length >= 2 && value.startsWith(open) && value.endsWith(close)) {
      return value.slice(1, -1);
    }
  }
  return null;
}

/**
 * An explicit width from a Markdown image title — the RENDERER path, where
 * react-markdown has already parsed the title out of the destination.
 *
 * Anything that is not exactly our grammar, or is out of range, is an ordinary
 * human-authored title: `undefined`, and the CSS default cap applies. Being strict
 * here is what makes `"My holiday photo"` safe to keep as a plain title.
 */
export function parseImageWidth(title: string | null | undefined): number | undefined {
  if (typeof title !== 'string') {
    return undefined;
  }
  const match = SIZE_TITLE.exec(title);
  if (!match) {
    return undefined;
  }
  const width = Number(match[1]);
  return inRange(width) ? width : undefined;
}

/**
 * The same, read from a raw link DESTINATION (`/api/uploads/x "w=320"`) — the EDITOR
 * path, which sees the line before any Markdown parser touches it.
 */
export function parseDestinationWidth(destination: string): number | undefined {
  const trimmed = destination.trim();
  const gap = trimmed.search(/\s/);
  if (gap < 0) {
    return undefined; // destination only — no title, so no explicit width
  }
  const title = unwrapTitle(trimmed.slice(gap).trim());
  return title === null ? undefined : parseImageWidth(title);
}

/**
 * The width `imageMarkdown` would actually emit: rounded and in range, else
 * `undefined`. Callers that keep a parsed block alongside its serialised line use
 * this so the two can never disagree.
 */
export function normalizeImageWidth(width: number | undefined): number | undefined {
  if (typeof width !== 'number' || !Number.isFinite(width)) {
    return undefined;
  }
  const rounded = Math.round(width);
  return inRange(rounded) ? rounded : undefined;
}

/**
 * The single emitter for a card image line — every place that writes one goes through
 * here, so the format lives in exactly one spot.
 *
 * With no (or an unusable) width it returns exactly `![alt](src)`, byte-identical to
 * what the app has always written. A width that isn't a whole number in range is
 * DROPPED rather than emitted, so this function is structurally incapable of
 * producing a line that doesn't parse back to the same block — which is what makes
 * `splitBlocks`/`joinBlocks` stay idempotent.
 */
export function imageMarkdown(src: string, alt: string, width?: number): string {
  const normalized = normalizeImageWidth(width);
  return `![${alt}](${src}${normalized === undefined ? '' : ` "w=${normalized}"`})`;
}

interface ResizeImageOpts {
  min?: number;
  max?: number;
}

/**
 * The bounds a resize gesture starts from — the pure half of `CardImageBlock.measure`.
 *
 * `imageWidth` is the image's RENDERED width (world px). `containerWidth` is the CARD's
 * available content width, or null when nothing measurable was found. The cap is the
 * CARD, not `IMAGE_WIDTH_MAX`: the grip must stop at the card edge instead of counting
 * up while nothing visibly moves.
 *
 * Two guards that are not cosmetic:
 *
 * - An UNMEASURABLE container falls back to `IMAGE_WIDTH_MAX` rather than to whatever
 *   the image currently is. A max equal to the start width freezes the grip — every
 *   rightward drag clamps straight back — which is exactly the bug this replaced.
 * - `Math.max(containerWidth, imageWidth)` keeps the max from ever landing BELOW what is
 *   already on screen (a stored width surviving a card narrowing). Otherwise the very
 *   first pointer event clamps down, so a click with no movement would shrink the image.
 *
 * `IMAGE_WIDTH_MAX` still applies on top of the container: a card may be `SIZE_MAX`
 * (10 000) world px wide, but `imageMarkdown` DROPS a width outside the `w=` grammar's
 * four-digit range, so an uncapped drag would commit nothing at all.
 */
export function imageResizeBounds(
  imageWidth: number,
  containerWidth: number | null,
): { width: number; max: number } | null {
  if (!Number.isFinite(imageWidth) || imageWidth <= 0) {
    return null; // not laid out yet — refuse the gesture
  }
  const bounds = (available: number): { width: number; max: number } => ({
    width: imageWidth,
    max: Math.min(IMAGE_WIDTH_MAX, available),
  });
  if (containerWidth === null || !Number.isFinite(containerWidth) || containerWidth <= 0) {
    return bounds(IMAGE_WIDTH_MAX);
  }
  return bounds(Math.max(containerWidth, imageWidth));
}

/**
 * New explicit width (world px, integer) for an image-resize drag.
 *
 * `delta` is the pointer's travel in SCREEN px since pointer-down. It is rotated into
 * the CARD's local axes — the card wrapper carries `transform: rotate(...)`, so a
 * screen-horizontal drag is not an image-horizontal drag on a rotated card — and then
 * divided by `zoom` to reach world px. That is the same reconstruction `useCardResize`
 * performs, minus the anchor bookkeeping, because the image's LEFT edge is pinned by
 * layout rather than by us.
 *
 * The grip is on the image's RIGHT edge, so a rightward drag grows the image.
 */
export function resizeImageWidth(
  startWidth: number,
  delta: { dx: number; dy: number },
  zoom: number,
  rotation: number,
  opts: ResizeImageOpts = {},
): number {
  const min = opts.min ?? IMAGE_WIDTH_MIN;
  // `max` can be the CONTAINER's width, which on a very narrow card is below `min` —
  // guard so a caller can never invert the range.
  const max = Math.max(min, opts.max ?? IMAGE_WIDTH_MAX);
  const rad = (rotation * Math.PI) / 180;
  const local = delta.dx * Math.cos(rad) + delta.dy * Math.sin(rad);
  const next = startWidth + local / (zoom || 1);
  return Math.round(clamp(Number.isFinite(next) ? next : startWidth, min, max));
}
