import { describe, expect, it } from 'vitest';
import { ROW_BAND_PX, sortCardsForReading, type ReadingOrderCard } from './noteOrder';

const card = (id: string, x: number, y: number): ReadingOrderCard => ({ id, x, y });
const ids = (cards: readonly ReadingOrderCard[]): string[] => cards.map((c) => c.id);

describe('sortCardsForReading', () => {
  it('reads each band left to right, then moves down', () => {
    const cards = [card('c', 100, 400), card('a', 300, 0), card('b', 0, 10)];
    // `a` and `b` are within the band, so they are one row read left to right.
    expect(ids(sortCardsForReading(cards))).toEqual(['b', 'a', 'c']);
  });

  // A chained comparison would let a staircase collapse into one arbitrarily tall
  // "row"; anchoring to the band's FIRST card bounds every band to `band` px.
  it('anchors a band to the card that opened it, not the previous card', () => {
    // `c` is only 40 below `b`, but 80 below the anchor `a` — so it starts a row.
    const cards = [card('a', 500, 0), card('b', 500, 40), card('c', 0, 80)];
    expect(ids(sortCardsForReading(cards, 48))).toEqual(['a', 'b', 'c']);
  });

  it('includes a card exactly ROW_BAND_PX below the anchor', () => {
    const cards = [card('a', 500, 0), card('b', 0, ROW_BAND_PX)];
    expect(ids(sortCardsForReading(cards))).toEqual(['b', 'a']);
  });

  it('breaks an equal y with x, and an equal x with id', () => {
    expect(ids(sortCardsForReading([card('b', 200, 0), card('a', 100, 0)]))).toEqual(['a', 'b']);
    expect(ids(sortCardsForReading([card('b', 0, 0), card('a', 0, 0)]))).toEqual(['a', 'b']);
  });

  // The order must not depend on how react-query happened to hand us the array.
  it('is independent of input order', () => {
    const cards = [card('a', 0, 0), card('b', 300, 20), card('c', 100, 400), card('d', 0, 401)];
    const expected = ids(sortCardsForReading(cards));
    expect(ids(sortCardsForReading([...cards].reverse()))).toEqual(expected);
    expect(ids(sortCardsForReading([cards[2], cards[0], cards[3], cards[1]]))).toEqual(expected);
  });

  // The input is the react-query cache array — reordering it corrupts the canvas.
  it('does not mutate the input', () => {
    const cards = [card('c', 0, 400), card('a', 0, 0), card('b', 0, 10)];
    const snapshot = [...cards];
    const result = sortCardsForReading(cards);
    expect(cards).toEqual(snapshot);
    expect(result).not.toBe(cards);
  });

  it('handles empty and single-card boards', () => {
    expect(sortCardsForReading([])).toEqual([]);
    expect(ids(sortCardsForReading([card('a', 5, 5)]))).toEqual(['a']);
  });

  it('orders negative world coordinates correctly', () => {
    const cards = [card('b', 0, 0), card('a', -500, -400), card('c', -100, 900)];
    expect(ids(sortCardsForReading(cards))).toEqual(['a', 'b', 'c']);
  });

  it('honours a custom band — zero degenerates to strict y, x, id', () => {
    const cards = [card('a', 500, 0), card('b', 0, 10)];
    expect(ids(sortCardsForReading(cards, 0))).toEqual(['a', 'b']);
  });

  it('keeps every card exactly once', () => {
    const cards = Array.from({ length: 50 }, (_, i) =>
      card(`c${i}`, (i * 37) % 900, (i * 53) % 700),
    );
    expect(sortCardsForReading(cards)).toHaveLength(50);
    expect(new Set(ids(sortCardsForReading(cards))).size).toBe(50);
  });
});
