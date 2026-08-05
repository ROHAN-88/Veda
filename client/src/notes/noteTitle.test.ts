import { describe, expect, it } from 'vitest';
import { deriveNoteTitle, NOTE_TITLE_MAX } from './noteTitle';

const IMG = '/api/uploads/8f3e0c2a-0000-4000-8000-000000000001';

describe('deriveNoteTitle — which line wins', () => {
  it('uses the first line', () => {
    expect(deriveNoteTitle('Sprint plan\nrest of the note')).toBe('Sprint plan');
  });

  it('skips leading blank and whitespace-only lines', () => {
    expect(deriveNoteTitle('\n   \n\tReal title\nbody')).toBe('Real title');
  });

  it('skips a leading thematic break or frontmatter fence', () => {
    expect(deriveNoteTitle('---\ntitle here')).toBe('title here');
    expect(deriveNoteTitle('***\ntitle here')).toBe('title here');
  });

  it('prefers text over a leading image', () => {
    expect(deriveNoteTitle(`![diagram](${IMG})\nThe actual heading`)).toBe('The actual heading');
  });

  it('falls back to the first image alt when the card is all images', () => {
    expect(deriveNoteTitle(`![Architecture diagram](${IMG})`)).toBe('Architecture diagram');
  });

  it('returns null when there is nothing to show', () => {
    expect(deriveNoteTitle('')).toBeNull();
    expect(deriveNoteTitle('   \n\t\n  ')).toBeNull();
    expect(deriveNoteTitle(`![](${IMG})`)).toBeNull();
  });
});

describe('deriveNoteTitle — stripping Markdown', () => {
  it('strips ATX headings at every level', () => {
    expect(deriveNoteTitle('# Heading')).toBe('Heading');
    expect(deriveNoteTitle('###### Deep')).toBe('Deep');
  });

  it('strips blockquote, bullet, ordered and task markers', () => {
    expect(deriveNoteTitle('> quoted')).toBe('quoted');
    expect(deriveNoteTitle('- item')).toBe('item');
    expect(deriveNoteTitle('1. item')).toBe('item');
    expect(deriveNoteTitle('- [ ] todo')).toBe('todo');
    expect(deriveNoteTitle('- [x] done')).toBe('done');
  });

  it('unwraps emphasis, code and strikethrough', () => {
    expect(deriveNoteTitle('**Bold** start')).toBe('Bold start');
    expect(deriveNoteTitle('`code` first')).toBe('code first');
    expect(deriveNoteTitle('~~gone~~ but here')).toBe('gone but here');
    expect(deriveNoteTitle('**_both_** wrapped')).toBe('both wrapped');
  });

  // A mangled identifier in a title reads as a bug, so intraword `_` is left alone.
  it('leaves an intraword underscore alone', () => {
    expect(deriveNoteTitle('snake_case_name matters')).toBe('snake_case_name matters');
  });

  it('collapses internal whitespace', () => {
    expect(deriveNoteTitle('spaced\tout   words')).toBe('spaced out words');
  });
});

describe('deriveNoteTitle — never leaks a URL', () => {
  it('reduces a link to its label', () => {
    expect(deriveNoteTitle('[the label](https://example.com/secret)')).toBe('the label');
  });

  it('reduces an inline image to its alt', () => {
    expect(deriveNoteTitle(`see ![shot](${IMG}) here`)).toBe('see shot here');
  });

  // `splitBlocks` leaves an external image as TEXT (the renderer would drop it), so
  // this is the path that could otherwise surface an attacker-controlled address.
  it('reduces an external image to its alt, never the address', () => {
    const title = deriveNoteTitle('![x](https://evil.example/tracker.png)');
    expect(title).toBe('x');
    expect(title).not.toContain('evil.example');
  });
});

describe('deriveNoteTitle — truncation', () => {
  it('cuts an over-long line and marks it', () => {
    const title = deriveNoteTitle('a'.repeat(NOTE_TITLE_MAX + 50));
    expect(title).toHaveLength(NOTE_TITLE_MAX + 1);
    expect(title?.endsWith('…')).toBe(true);
  });

  it('leaves a title at exactly the limit alone', () => {
    const exact = 'a'.repeat(NOTE_TITLE_MAX);
    expect(deriveNoteTitle(exact)).toBe(exact);
  });

  // Cutting by code unit would leave a lone surrogate and render as a replacement
  // character; `Array.from` iterates code points.
  it('never splits an astral character in half', () => {
    const title = deriveNoteTitle('😀'.repeat(NOTE_TITLE_MAX + 10));
    expect(Array.from(title as string)).toHaveLength(NOTE_TITLE_MAX + 1);
    expect(title).not.toContain('�');
  });
});
