/**
 * Reading order for the notes view: the order a person's eye would take across the
 * board — top to bottom, left to right within a row. Pure, so it is exhaustively
 * testable without a DOM.
 *
 * Cards have no user-defined order. `zIndex` is paint order and shifts whenever a
 * card is brought to front, so a list keyed on it would reshuffle as you click
 * around the board. Position is what the user actually arranged, so position is
 * what the list follows.
 */

/**
 * Two cards belong to the same row when their tops are within this many WORLD px
 * of the row's first card.
 *
 * 48 is chosen against the card defaults: hand-placed cards in a visual row differ
 * by tens of px, while `DEFAULT_CARD_H` is 160, so cards genuinely stacked one
 * above another are normally >= 160 apart — a 3.3x margin. Accepted failure mode:
 * two minimum-height (40 px) cards stacked flush fall in one band and read left to
 * right. `sortCardsForReading` takes an override so a height-proportional rule
 * stays a contained change if that ever bites.
 */
export const ROW_BAND_PX = 48;

/** The only fields the ordering depends on — any `Card` satisfies this. */
export interface ReadingOrderCard {
  id: string;
  x: number;
  y: number;
}

/**
 * `id` compared with `<`/`>`, never `localeCompare` — locale collation is
 * environment-dependent, and the list order must not differ between browsers.
 */
const compareId = (a: ReadingOrderCard, b: ReadingOrderCard): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const compareTopLeft = (a: ReadingOrderCard, b: ReadingOrderCard): number =>
  a.y - b.y || a.x - b.x || compareId(a, b);

const compareLeft = (a: ReadingOrderCard, b: ReadingOrderCard): number =>
  a.x - b.x || compareId(a, b);

/**
 * Sort cards into reading order: group them into horizontal bands, then read each
 * band left to right.
 *
 * A band is anchored to the card that OPENED it, not to the previous card. With a
 * chained comparison a staircase of cards each 40 px below the last would collapse
 * into one arbitrarily tall "row" that reads as gibberish; anchoring bounds every
 * band to `band` px.
 *
 * The result is fully determined by the card set — the initial sort is a total
 * order (the `id` tiebreak makes it one), so shuffling the input cannot change the
 * output.
 */
export function sortCardsForReading<T extends ReadingOrderCard>(
  cards: readonly T[],
  band: number = ROW_BAND_PX,
): T[] {
  // Copy FIRST. `sort` mutates in place, and the caller passes the react-query
  // cache array — reordering it would corrupt the canvas's own data and break the
  // referential equality its memoisation depends on.
  const byPosition = [...cards].sort(compareTopLeft);

  const ordered: T[] = [];
  let row: T[] = [];
  let anchorY = 0;

  const flushRow = (): void => {
    if (row.length > 0) {
      ordered.push(...row.sort(compareLeft));
      row = [];
    }
  };

  for (const card of byPosition) {
    if (row.length === 0) {
      anchorY = card.y;
    } else if (card.y - anchorY > band) {
      flushRow();
      anchorY = card.y;
    }
    row.push(card);
  }
  flushRow();

  return ordered;
}
