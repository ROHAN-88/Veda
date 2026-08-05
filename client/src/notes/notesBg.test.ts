import { describe, expect, it } from 'vitest';
import { PALETTE } from '../canvas/cardShapes';
import { isNotesBg, notesSurfaceStyle } from './notesBg';

describe('isNotesBg', () => {
  it('accepts a six-digit hex in either case', () => {
    expect(isNotesBg('#dbeafe')).toBe(true);
    expect(isNotesBg('#DBEAFE')).toBe(true);
  });

  it('accepts empty — the "follow the theme" default', () => {
    expect(isNotesBg('')).toBe(true);
  });

  // The value ends up inside a `style` attribute, so anything that is not one of
  // the two accepted shapes must be refused here as well as on the server.
  it('rejects anything else', () => {
    expect(isNotesBg('red')).toBe(false);
    expect(isNotesBg('#fff')).toBe(false);
    expect(isNotesBg('#dbeafee')).toBe(false);
    expect(isNotesBg('dbeafe')).toBe(false);
    expect(isNotesBg('#dbeaf')).toBe(false);
    expect(isNotesBg('red; background:url(x)')).toBe(false);
    expect(isNotesBg('#dbeafe;color:red')).toBe(false);
  });
});

describe('notesSurfaceStyle', () => {
  it('returns no style when nothing is chosen, so the theme applies', () => {
    expect(notesSurfaceStyle('')).toEqual({});
  });

  it('paints the background and pins a readable text colour', () => {
    expect(notesSurfaceStyle('#dbeafe')).toEqual({ background: '#dbeafe', color: '#000000' });
  });

  // Under a dark OS theme the inherited text is light, so a light swatch without
  // this pairing would render light-on-light. This is the test that guards it.
  it('pins white text on a dark background and black on a light one', () => {
    expect(notesSurfaceStyle('#1e3a8a').color).toBe('#ffffff');
    expect(notesSurfaceStyle('#fef9c3').color).toBe('#000000');
  });

  it('gives every palette colour a pinned text colour', () => {
    for (const colour of PALETTE) {
      const style = notesSurfaceStyle(colour);
      expect(style.background).toBe(colour);
      expect(style.color === '#000000' || style.color === '#ffffff').toBe(true);
    }
  });

  it('falls back to no style for a value it would not emit', () => {
    expect(notesSurfaceStyle('red')).toEqual({});
    expect(notesSurfaceStyle('#dbeafe;color:red')).toEqual({});
  });
});
