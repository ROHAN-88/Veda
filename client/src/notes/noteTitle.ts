import { splitBlocks } from '../canvas/cardBlocks';

/**
 * A display title for a card in the notes view.
 *
 * A card has NO title column — `content` is one Markdown string — so the title is
 * derived, and the rule is deliberately simple and stated once here:
 *
 *   **The title is the first line of the card that renders as text**, with its
 *   Markdown syntax stripped. If the card is all images, the first image's alt text
 *   is used instead. If there is nothing at all, there is no title.
 *
 * It is a LABEL for the list, never stored and never editable. Pure — no DOM.
 */

/**
 * Titles are truncated at this many code points. `content` may legitimately be a
 * single 10 000-character line (the server's CONTENT_MAX), which would otherwise
 * become a 10 kB heading.
 */
export const NOTE_TITLE_MAX = 120;

/** A line that is only `---`, `***` or `___` — a rule, and also a frontmatter fence. */
const THEMATIC_BREAK = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/**
 * Markdown syntax removed from a single line, in order. This is a bounded list of
 * string operations, not a parser: it runs on one line per card and only has to be
 * right enough to produce a readable label.
 */
const LEADING = [
  /** Blockquote markers, possibly nested. */
  /^\s*(?:>\s*)+/,
  /** ATX heading. */
  /^\s{0,3}#{1,6}\s+/,
  /** Bullet or ordered-list marker. */
  /^\s*(?:[-*+]|\d{1,9}[.)])\s+/,
  /** GFM task marker, which follows a bullet. */
  /^\[[ xX]\]\s*/,
] as const;

/**
 * Paired inline delimiters, unwrapped to their contents. `_`/`__` carry lookarounds
 * so `snake_case_name` survives intact — CommonMark does not treat intraword `_` as
 * emphasis either, and a mangled identifier in a title reads as a bug.
 */
const PAIRED: readonly [RegExp, string][] = [
  [/\*\*(.+?)\*\*/g, '$1'],
  [/(?<![A-Za-z0-9])__(.+?)__(?![A-Za-z0-9])/g, '$1'],
  [/\*(.+?)\*/g, '$1'],
  [/(?<![A-Za-z0-9])_(.+?)_(?![A-Za-z0-9])/g, '$1'],
  [/~~(.+?)~~/g, '$1'],
  [/`(.+?)`/g, '$1'],
];

/**
 * One line of Markdown as plain text. Images collapse to their ALT and links to
 * their LABEL — a URL must never end up in a title, which also means an external
 * image line (left as text by `splitBlocks`, since the renderer would drop it)
 * contributes its alt and never the attacker's address.
 *
 * Raw HTML is left as literal text, exactly as `CardMarkdown` treats it; React
 * escapes it when the title is rendered.
 */
function stripInlineMarkdown(line: string): string {
  let out = line;
  for (const pattern of LEADING) {
    out = out.replace(pattern, '');
  }
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Twice, so nested pairs such as `**_both_**` fully unwrap.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const [pattern, replacement] of PAIRED) {
      out = out.replace(pattern, replacement);
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Cut to `NOTE_TITLE_MAX` by code point, so an emoji is never split in half. */
function truncate(title: string): string {
  const glyphs = Array.from(title);
  return glyphs.length > NOTE_TITLE_MAX ? `${glyphs.slice(0, NOTE_TITLE_MAX).join('')}…` : title;
}

/**
 * Derive a card's list title, or `null` when the card has nothing to show one from
 * (the caller decides the placeholder copy — this stays pure).
 */
export function deriveNoteTitle(content: string): string | null {
  // Reuse the canvas's tested splitter: an image alone on its line is an image
  // block, so a leading picture is skipped rather than becoming a literal `![](…)`.
  const blocks = splitBlocks(content);

  for (const block of blocks) {
    if (block.kind !== 'text') {
      continue;
    }
    for (const line of block.text.split('\n')) {
      if (line.trim().length === 0 || THEMATIC_BREAK.test(line)) {
        continue;
      }
      const stripped = stripInlineMarkdown(line);
      if (stripped.length > 0) {
        return truncate(stripped);
      }
    }
  }

  // All images: the first one's alt text is the best label available.
  for (const block of blocks) {
    if (block.kind === 'image') {
      const alt = block.alt.trim();
      if (alt.length > 0) {
        return truncate(alt);
      }
    }
  }

  return null;
}
