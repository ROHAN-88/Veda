import { describe, expect, it } from 'vitest';
import { insertAt } from './textInsert';

describe('insertAt', () => {
  it('inserts at the caret (empty selection)', () => {
    expect(insertAt('abcd', 2, 2, 'XY')).toEqual({ value: 'abXYcd', caret: 4 });
  });

  it('replaces a selection', () => {
    expect(insertAt('abcd', 1, 3, 'X')).toEqual({ value: 'aXd', caret: 2 });
  });

  it('clamps out-of-range / inverted offsets', () => {
    expect(insertAt('ab', 99, 99, '!')).toEqual({ value: 'ab!', caret: 3 });
    // Inverted (start > end) collapses to start=3 and inserts there.
    expect(insertAt('abcd', 3, 1, 'X')).toEqual({ value: 'abcXd', caret: 4 });
  });
});
