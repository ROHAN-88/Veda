import { CARD_CONTENT_MAX } from './constants';
import { imageMarkdown, normalizeImageWidth, parseDestinationWidth } from './imageSize';
import { transformCardUrl } from './media';

/**
 * A card's Markdown seen as an ordered list of BLOCKS, so the editor can show real
 * images in place with text above and below them. Pure — no DOM, no React.
 *
 * Storage is unchanged: `card.content` is still one Markdown string. Blocks are a
 * view over it, and only a line that is SOLELY an image becomes an image block —
 * an image written inside a sentence stays part of its text block, so nothing the
 * user wrote is ever reordered or restructured.
 */
export type CardBlock =
  /**
   * A line that is solely `![alt](src)` — stays a picture while editing. `width` is
   * an explicit size in world px read from the `"w=…"` title (see `imageSize.ts`);
   * absent means the image has never been resized and the CSS default cap applies.
   * It is a READ-ONLY projection of `raw` — only `setImageWidthAt` changes it, and
   * that rewrites `raw` in the same step so the two can never disagree.
   */
  | { kind: 'image'; src: string; alt: string; width?: number; raw: string }
  /** Everything else, verbatim — one block per run of consecutive lines. */
  | { kind: 'text'; text: string };

/** `![alt](src)` (with an optional title) alone on its line. */
const IMAGE_LINE = /^\s*!\[([^\]]*)\]\(([^)]*)\)\s*$/;

const text = (value: string): CardBlock => ({ kind: 'text', text: value });

/**
 * Parse an image-only line, or null. The src must pass the SAME policy the renderer
 * applies (`transformCardUrl` — same-origin uploads only), so the editor can never
 * load an external image the display path would have dropped; anything else stays
 * ordinary text.
 */
function parseImageLine(line: string): CardBlock | null {
  const match = IMAGE_LINE.exec(line);
  if (!match) {
    return null;
  }
  const destination = match[2].trim();
  const src = destination.split(/\s+/)[0] ?? '';
  if (src.length === 0 || transformCardUrl(src, 'src') !== src) {
    return null;
  }
  return {
    kind: 'image',
    src,
    alt: match[1],
    width: parseDestinationWidth(destination),
    raw: line,
  };
}

/** Split content into blocks. Consecutive non-image lines form one text block. */
export function splitBlocks(content: string): CardBlock[] {
  const blocks: CardBlock[] = [];
  let run: string[] = [];
  const flush = (): void => {
    if (run.length > 0) {
      blocks.push(text(run.join('\n')));
      run = [];
    }
  };
  for (const line of content.split('\n')) {
    const image = parseImageLine(line);
    if (image) {
      flush();
      blocks.push(image);
    } else {
      run.push(line);
    }
  }
  flush();
  return blocks;
}

/**
 * Blocks back to Markdown. Empty text blocks are dropped, so the slots
 * `editableBlocks` adds around images don't accumulate blank lines — which also
 * makes this idempotent: re-splitting and re-joining yields the same string.
 */
export function joinBlocks(blocks: CardBlock[]): string {
  return blocks
    .filter((block) => block.kind === 'image' || block.text.length > 0)
    .map((block) => (block.kind === 'image' ? block.raw : block.text))
    .join('\n');
}

/**
 * Pad with empty text blocks so every image has somewhere to type before and after
 * it (editor-only — `joinBlocks` drops the ones left empty).
 */
export function editableBlocks(blocks: CardBlock[]): CardBlock[] {
  const out: CardBlock[] = [];
  let needsText = true;
  for (const block of blocks) {
    if (block.kind === 'image') {
      if (needsText) {
        out.push(text(''));
      }
      out.push(block);
      needsText = true;
    } else {
      out.push(block);
      needsText = false;
    }
  }
  if (needsText) {
    out.push(text(''));
  }
  return out;
}

/** Where the caret should land after a block edit. */
export interface BlockEdit {
  blocks: CardBlock[];
  focusIndex: number;
  focusCaret: number;
}

/**
 * Drop an image at the caret: the text block splits in two and the image lands
 * between the halves, so the picture appears exactly where the cursor was.
 */
export function insertImageBlock(
  blocks: CardBlock[],
  blockIndex: number,
  caret: number,
  src: string,
): BlockEdit {
  const target = blocks[blockIndex];
  // Never born sized — a new image gets the CSS default cap until the user drags it.
  const image: CardBlock = { kind: 'image', src, alt: '', raw: imageMarkdown(src, '') };
  if (!target || target.kind !== 'text') {
    // No text block to split (shouldn't happen via the editor) — append instead.
    const next = [...blocks, image, text('')];
    return { blocks: next, focusIndex: next.length - 1, focusCaret: 0 };
  }
  const at = Math.max(0, Math.min(caret, target.text.length));
  const next = [
    ...blocks.slice(0, blockIndex),
    text(target.text.slice(0, at)),
    image,
    text(target.text.slice(at)),
    ...blocks.slice(blockIndex + 1),
  ];
  return { blocks: next, focusIndex: blockIndex + 2, focusCaret: 0 };
}

/** Remove one image block, merging the text on either side of it back together. */
export function removeImageAt(blocks: CardBlock[], blockIndex: number): BlockEdit {
  const target = blocks[blockIndex];
  if (!target || target.kind !== 'image') {
    return { blocks, focusIndex: blockIndex, focusCaret: 0 };
  }
  const before = blocks[blockIndex - 1];
  const after = blocks[blockIndex + 1];
  if (before?.kind === 'text' && after?.kind === 'text') {
    const glue = before.text.length > 0 && after.text.length > 0 ? '\n' : '';
    const merged = text(before.text + glue + after.text);
    return {
      blocks: [...blocks.slice(0, blockIndex - 1), merged, ...blocks.slice(blockIndex + 2)],
      focusIndex: blockIndex - 1,
      focusCaret: before.text.length,
    };
  }
  const next = [...blocks.slice(0, blockIndex), ...blocks.slice(blockIndex + 1)];
  return { blocks: next, focusIndex: Math.max(0, blockIndex - 1), focusCaret: 0 };
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One `![alt](src …)` anywhere in the content, capturing the alt text. Shared by the
 * remove and resize fallbacks so the two can never drift. The `[^)]*` after the src
 * swallows any title, including our own `"w=…"`.
 */
const inlineImageRegExp = (src: string): RegExp =>
  new RegExp(`!\\[([^\\]]*)\\]\\(\\s*${escapeRegExp(src)}[^)]*\\)`);

/**
 * Remove the first image with this `src` from raw content — used by the × on a
 * rendered (not-being-edited) card. Falls back to a substring removal when the
 * image is inline inside a paragraph rather than alone on its line.
 */
export function removeImageBySrc(content: string, src: string): string {
  const blocks = splitBlocks(content);
  const index = blocks.findIndex((block) => block.kind === 'image' && block.src === src);
  if (index >= 0) {
    return joinBlocks(removeImageAt(blocks, index).blocks);
  }
  return content.replace(inlineImageRegExp(src), '');
}

/**
 * Set (or clear, with `undefined`) an image block's explicit width. Rewrites `raw` in
 * the same step so `joinBlocks` stays the single serialiser and the result re-parses
 * to an identical block — i.e. split→join stays idempotent. The stored width is the
 * one that was actually SERIALISED, so a block can never claim a size its own Markdown
 * doesn't carry. Returns the input array untouched when nothing would change.
 */
export function setImageWidthAt(
  blocks: CardBlock[],
  blockIndex: number,
  width: number | undefined,
): CardBlock[] {
  const target = blocks[blockIndex];
  const next = normalizeImageWidth(width);
  if (!target || target.kind !== 'image' || target.width === next) {
    return blocks;
  }
  const updated = [...blocks];
  updated[blockIndex] = {
    kind: 'image',
    src: target.src,
    alt: target.alt,
    width: next,
    raw: imageMarkdown(target.src, target.alt, next),
  };
  return updated;
}

/**
 * Set the explicit width of the first image with this `src` in raw content — used by
 * the resize grip on a rendered (not-being-edited) card. Falls back to an in-place
 * rewrite when the image is inline inside a paragraph rather than alone on its line.
 *
 * Returns `content` unchanged when nothing matched, or when the result would exceed
 * the server's content cap — a silent no-op beats a 400 that rolls the optimistic
 * update back and snaps the image to its old size with no explanation.
 */
export function setImageWidthBySrc(
  content: string,
  src: string,
  width: number | undefined,
): string {
  const cap = (next: string): string => (next.length > CARD_CONTENT_MAX ? content : next);
  const blocks = splitBlocks(content);
  const index = blocks.findIndex((block) => block.kind === 'image' && block.src === src);
  if (index >= 0) {
    const updated = setImageWidthAt(blocks, index, width);
    // Bail before joining: a no-op must not normalise the user's blank lines.
    return updated === blocks ? content : cap(joinBlocks(updated));
  }
  // A function replacer, never a `'$1'` string — a `$&` inside the alt text would
  // otherwise be re-interpreted as a match reference.
  return cap(
    content.replace(inlineImageRegExp(src), (_match, alt: string) =>
      imageMarkdown(src, alt, width),
    ),
  );
}

/** Vertical extent of one rendered text block, in any consistent coordinate space. */
export interface BlockRect {
  index: number;
  top: number;
  bottom: number;
}

/**
 * The text block a click at `y` belongs to — the one containing it, else the
 * closest. Keeps the caret in the paragraph the user double-clicked.
 */
export function nearestTextBlock(rects: BlockRect[], y: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (const rect of rects) {
    const distance = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    if (distance < bestDistance) {
      best = rect.index;
      bestDistance = distance;
    }
  }
  return best;
}
