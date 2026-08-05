import { describe, expect, it } from 'vitest';
import { parseViewMode, VIEW_PARAM, withViewMode } from './viewMode';

describe('parseViewMode', () => {
  it('reads the notes view', () => {
    expect(parseViewMode('notes')).toBe('notes');
  });

  it('is case- and space-insensitive', () => {
    expect(parseViewMode('NOTES')).toBe('notes');
    expect(parseViewMode(' notes ')).toBe('notes');
    expect(parseViewMode('Notes')).toBe('notes');
  });

  // A typo or a hand-edited URL must degrade to today's behaviour, never an error.
  it('falls back to the whiteboard for anything else', () => {
    expect(parseViewMode(null)).toBe('whiteboard');
    expect(parseViewMode(undefined)).toBe('whiteboard');
    expect(parseViewMode('')).toBe('whiteboard');
    expect(parseViewMode('whiteboard')).toBe('whiteboard');
    expect(parseViewMode('canvas')).toBe('whiteboard');
    expect(parseViewMode('noteszzz')).toBe('whiteboard');
  });
});

describe('withViewMode', () => {
  it('sets the param for notes', () => {
    expect(withViewMode(new URLSearchParams(), 'notes').get(VIEW_PARAM)).toBe('notes');
  });

  // The whiteboard is the default, so its URL stays exactly what it is today.
  it('removes the param for the whiteboard', () => {
    const params = new URLSearchParams('view=notes');
    expect(withViewMode(params, 'whiteboard').has(VIEW_PARAM)).toBe(false);
  });

  it('round-trips', () => {
    const board = new URLSearchParams();
    const notes = withViewMode(board, 'notes');
    expect(withViewMode(notes, 'whiteboard').toString()).toBe(board.toString());
  });

  it('preserves unrelated params in both directions', () => {
    const params = new URLSearchParams('zoom=2&tab=a');
    expect(withViewMode(params, 'notes').get('zoom')).toBe('2');
    expect(withViewMode(new URLSearchParams('view=notes&zoom=2'), 'whiteboard').get('zoom')).toBe(
      '2',
    );
  });

  // The caller passes react-router's LIVE params object — mutating it is a bug.
  it('returns a new object and leaves the input untouched', () => {
    const params = new URLSearchParams('zoom=2');
    const next = withViewMode(params, 'notes');
    expect(next).not.toBe(params);
    expect(params.toString()).toBe('zoom=2');
  });
});
