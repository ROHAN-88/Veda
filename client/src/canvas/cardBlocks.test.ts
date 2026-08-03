import { describe, expect, it } from 'vitest';
import {
  editableBlocks,
  insertImageBlock,
  joinBlocks,
  nearestTextBlock,
  removeImageAt,
  removeImageBySrc,
  setImageWidthAt,
  setImageWidthBySrc,
  splitBlocks,
} from './cardBlocks';
import { CARD_CONTENT_MAX } from './constants';

const IMG = '/api/uploads/8f3e0c2a-0000-4000-8000-000000000001';
const IMG2 = '/api/uploads/8f3e0c2a-0000-4000-8000-000000000002';

const roundTrip = (content: string): string => joinBlocks(splitBlocks(content));

describe('splitBlocks', () => {
  it('keeps plain text as a single block', () => {
    expect(splitBlocks('hello\nworld')).toEqual([{ kind: 'text', text: 'hello\nworld' }]);
  });

  it('lifts an image alone on its line into an image block', () => {
    expect(splitBlocks(`notes\n![shot](${IMG})\nmore`)).toEqual([
      { kind: 'text', text: 'notes' },
      { kind: 'image', src: IMG, alt: 'shot', raw: `![shot](${IMG})` },
      { kind: 'text', text: 'more' },
    ]);
  });

  it('leaves an image INSIDE a sentence as text (never reorders content)', () => {
    const content = `see ![](${IMG}) here`;
    expect(splitBlocks(content)).toEqual([{ kind: 'text', text: content }]);
  });

  it('leaves an external image as text — the renderer would drop it anyway', () => {
    const content = '![](https://example.com/tracker.png)';
    expect(splitBlocks(content)).toEqual([{ kind: 'text', text: content }]);
  });

  it('handles empty content', () => {
    expect(splitBlocks('')).toEqual([{ kind: 'text', text: '' }]);
  });

  it('reads an explicit width out of the title without disturbing the src', () => {
    const line = `![shot](${IMG} "w=320")`;
    expect(splitBlocks(line)).toEqual([
      { kind: 'image', src: IMG, alt: 'shot', width: 320, raw: line },
    ]);
  });

  it('leaves a human-authored title alone — it is not a size', () => {
    const line = `![](${IMG} "Some caption")`;
    expect(splitBlocks(line)).toEqual([
      { kind: 'image', src: IMG, alt: '', width: undefined, raw: line },
    ]);
  });
});

describe('joinBlocks round-trip', () => {
  it.each([
    'hello',
    '',
    `![](${IMG})`,
    `text above\n![](${IMG})\ntext below`,
    `![](${IMG})\ntrailing text`,
    `leading text\n![](${IMG})`,
    `a\n\n![](${IMG})\n\nb`,
    `para one\n\npara two`,
    `![](${IMG} "w=320")`,
    `text above\n![alt](${IMG} "w=64")\ntext below`,
    `![](${IMG} "not a size")`,
  ])('preserves %j exactly', (content) => {
    expect(roundTrip(content)).toBe(content);
  });

  it('is idempotent for content it normalises (blank line between images)', () => {
    const content = `![](${IMG})\n\n![](${IMG2})`;
    const once = roundTrip(content);
    expect(once).toBe(`![](${IMG})\n![](${IMG2})`);
    expect(roundTrip(once)).toBe(once);
  });

  it('drops the empty slots editableBlocks adds', () => {
    const content = `![](${IMG})`;
    expect(joinBlocks(editableBlocks(splitBlocks(content)))).toBe(content);
  });
});

describe('editableBlocks', () => {
  it('gives an image a text slot before and after it', () => {
    expect(editableBlocks(splitBlocks(`![](${IMG})`))).toEqual([
      { kind: 'text', text: '' },
      { kind: 'image', src: IMG, alt: '', raw: `![](${IMG})` },
      { kind: 'text', text: '' },
    ]);
  });

  it('adds a slot between two adjacent images', () => {
    const blocks = editableBlocks(splitBlocks(`![](${IMG})\n![](${IMG2})`));
    expect(blocks.map((b) => b.kind)).toEqual(['text', 'image', 'text', 'image', 'text']);
  });

  it('leaves an already-alternating list alone', () => {
    const blocks = splitBlocks(`a\n![](${IMG})\nb`);
    expect(editableBlocks(blocks)).toEqual(blocks);
  });
});

describe('insertImageBlock', () => {
  it('splits the text block at the caret and lands the image between the halves', () => {
    const blocks = splitBlocks('before after');
    const result = insertImageBlock(blocks, 0, 'before'.length, IMG);
    expect(result.blocks).toEqual([
      { kind: 'text', text: 'before' },
      { kind: 'image', src: IMG, alt: '', raw: `![](${IMG})` },
      { kind: 'text', text: ' after' },
    ]);
    expect(result.focusIndex).toBe(2);
    expect(result.focusCaret).toBe(0);
    expect(joinBlocks(result.blocks)).toBe(`before\n![](${IMG})\n after`);
  });

  it('appends when the target is not a text block', () => {
    const blocks = splitBlocks(`![](${IMG})`);
    const result = insertImageBlock(blocks, 0, 0, IMG2);
    expect(result.blocks.map((b) => b.kind)).toEqual(['image', 'image', 'text']);
    expect(result.focusIndex).toBe(2);
  });

  it('clamps an out-of-range caret', () => {
    const result = insertImageBlock(splitBlocks('abc'), 0, 999, IMG);
    expect(joinBlocks(result.blocks)).toBe(`abc\n![](${IMG})`);
  });
});

describe('removeImageAt', () => {
  it('merges the surrounding text and puts the caret at the seam', () => {
    const blocks = splitBlocks(`above\n![](${IMG})\nbelow`);
    const result = removeImageAt(blocks, 1);
    expect(result.blocks).toEqual([{ kind: 'text', text: 'above\nbelow' }]);
    expect(result.focusIndex).toBe(0);
    expect(result.focusCaret).toBe('above'.length);
  });

  it('does not glue when one side is empty', () => {
    const blocks = editableBlocks(splitBlocks(`![](${IMG})\nbelow`));
    expect(joinBlocks(removeImageAt(blocks, 1).blocks)).toBe('below');
  });

  it('ignores a non-image index', () => {
    const blocks = splitBlocks('just text');
    expect(removeImageAt(blocks, 0).blocks).toBe(blocks);
  });
});

describe('removeImageBySrc', () => {
  it('removes a block image and keeps the text around it', () => {
    expect(removeImageBySrc(`above\n![](${IMG})\nbelow`, IMG)).toBe('above\nbelow');
  });

  it('removes only the matching image', () => {
    expect(removeImageBySrc(`![](${IMG})\n![](${IMG2})`, IMG2)).toBe(`![](${IMG})`);
  });

  it('removes an image that is inline inside a paragraph', () => {
    expect(removeImageBySrc(`see ![shot](${IMG}) here`, IMG)).toBe('see  here');
  });

  it('leaves content untouched when the src is absent', () => {
    const content = `above\n![](${IMG})`;
    expect(removeImageBySrc(content, IMG2)).toBe(content);
  });
});

describe('setImageWidthAt', () => {
  it('sets the width and rewrites raw in the same step', () => {
    const blocks = splitBlocks(`![shot](${IMG})`);
    const next = setImageWidthAt(blocks, 0, 320);
    expect(next[0]).toEqual({
      kind: 'image',
      src: IMG,
      alt: 'shot',
      width: 320,
      raw: `![shot](${IMG} "w=320")`,
    });
    expect(joinBlocks(next)).toBe(`![shot](${IMG} "w=320")`);
  });

  // The load-bearing property: a resized line must re-parse to exactly the same block.
  it('is idempotent — re-splitting the joined output yields identical blocks', () => {
    const next = setImageWidthAt(splitBlocks(`![](${IMG})`), 0, 320);
    expect(splitBlocks(joinBlocks(next))).toEqual(next);
  });

  it('clears the width back to the plain form', () => {
    const sized = splitBlocks(`![](${IMG} "w=320")`);
    expect(joinBlocks(setImageWidthAt(sized, 0, undefined))).toBe(`![](${IMG})`);
  });

  it('drops a width the format cannot carry rather than storing a lie', () => {
    const next = setImageWidthAt(splitBlocks(`![](${IMG})`), 0, 99_999);
    expect(next[0]).toEqual({
      kind: 'image',
      src: IMG,
      alt: '',
      width: undefined,
      raw: `![](${IMG})`,
    });
  });

  it('returns the same array for a non-image index', () => {
    const blocks = splitBlocks('just text');
    expect(setImageWidthAt(blocks, 0, 320)).toBe(blocks);
  });

  it('returns the same array when the width is unchanged', () => {
    const blocks = splitBlocks(`![](${IMG} "w=320")`);
    expect(setImageWidthAt(blocks, 0, 320)).toBe(blocks);
  });
});

describe('setImageWidthBySrc', () => {
  it('sizes a block image and keeps the surrounding text', () => {
    expect(setImageWidthBySrc(`above\n![](${IMG})\nbelow`, IMG, 320)).toBe(
      `above\n![](${IMG} "w=320")\nbelow`,
    );
  });

  it('sizes an image that is inline inside a paragraph', () => {
    expect(setImageWidthBySrc(`see ![shot](${IMG}) here`, IMG, 320)).toBe(
      `see ![shot](${IMG} "w=320") here`,
    );
  });

  it('replaces an existing size rather than appending a second one', () => {
    expect(setImageWidthBySrc(`![](${IMG} "w=320")`, IMG, 480)).toBe(`![](${IMG} "w=480")`);
  });

  it('leaves content untouched when the src is absent', () => {
    const content = `above\n![](${IMG})`;
    expect(setImageWidthBySrc(content, IMG2, 320)).toBe(content);
  });

  it('does not normalise blank lines when nothing changes', () => {
    const content = `![](${IMG} "w=320")\n\n![](${IMG2})`;
    expect(setImageWidthBySrc(content, IMG, 320)).toBe(content);
  });

  // A `$&` in the alt text must survive the inline fallback's replacer.
  it('does not re-interpret match references in the alt text', () => {
    expect(setImageWidthBySrc(`see ![$& $1](${IMG}) here`, IMG, 320)).toBe(
      `see ![$& $1](${IMG} "w=320") here`,
    );
  });

  // Known limitation, recorded so it is documented rather than latent: react-markdown
  // gives the img override no positional info, so the rendered card can only address
  // an image by src. The block editor's path is index-based and therefore exact.
  it('sizes the FIRST of two images sharing one src', () => {
    expect(setImageWidthBySrc(`![](${IMG})\n![](${IMG})`, IMG, 320)).toBe(
      `![](${IMG} "w=320")\n![](${IMG})`,
    );
  });

  it('refuses an edit that would exceed the server content cap', () => {
    const content = `${'x'.repeat(CARD_CONTENT_MAX - 5)}\n![](${IMG})`;
    expect(setImageWidthBySrc(content, IMG, 320)).toBe(content);
  });
});

describe('nearestTextBlock', () => {
  const rects = [
    { index: 0, top: 0, bottom: 20 },
    { index: 3, top: 60, bottom: 90 },
  ];

  it('picks the block containing the point', () => {
    expect(nearestTextBlock(rects, 10)).toBe(0);
    expect(nearestTextBlock(rects, 70)).toBe(3);
  });

  it('picks the closest block when the point is in a gap (over an image)', () => {
    expect(nearestTextBlock(rects, 25)).toBe(0);
    expect(nearestTextBlock(rects, 55)).toBe(3);
  });

  it('falls back to the first block when there are no rects', () => {
    expect(nearestTextBlock([], 42)).toBe(0);
  });
});
