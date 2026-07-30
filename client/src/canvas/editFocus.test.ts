import { describe, expect, it } from 'vitest';
import { shouldEndEditing } from './editFocus';

/** Minimal `Node` stand-in — `shouldEndEditing` only ever calls `contains`. */
const nodeWith = (children: object[]): Node =>
  ({ contains: (n: Node | null) => children.includes(n as object) }) as unknown as Node;

describe('shouldEndEditing', () => {
  it('keeps editing when the document itself lost focus (native file picker)', () => {
    const container = nodeWith([]);
    expect(shouldEndEditing({ nextFocus: null, container, documentHasFocus: false })).toBe(false);
  });

  it('keeps editing when focus moves into the card chrome (media toolbar)', () => {
    const button = {} as Node;
    expect(
      shouldEndEditing({
        nextFocus: button,
        container: nodeWith([button]),
        documentHasFocus: true,
      }),
    ).toBe(false);
  });

  it('ends editing on a genuine click-away (no element focused, document focused)', () => {
    expect(
      shouldEndEditing({ nextFocus: null, container: nodeWith([]), documentHasFocus: true }),
    ).toBe(true);
  });

  it('ends editing when focus moves to an element outside the card', () => {
    const elsewhere = {} as Node;
    expect(
      shouldEndEditing({
        nextFocus: elsewhere,
        container: nodeWith([]),
        documentHasFocus: true,
      }),
    ).toBe(true);
  });

  it('ends editing when the card wrapper ref is not attached', () => {
    expect(
      shouldEndEditing({ nextFocus: {} as Node, container: null, documentHasFocus: true }),
    ).toBe(true);
  });
});
