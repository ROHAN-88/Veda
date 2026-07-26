import type { BulkCardUpdate } from '../api/cards';
import type { Card } from '../api/types';

/**
 * The inverse of a bulk card update: for every field the `after` patch changes,
 * capture the card's CURRENT value, so applying the result restores the card.
 * Pure — used to build undo commands (Phase 8).
 */
export function inverseUpdate(card: Card, after: BulkCardUpdate): BulkCardUpdate {
  const before: BulkCardUpdate = { id: after.id };
  if (after.x !== undefined) before.x = card.x;
  if (after.y !== undefined) before.y = card.y;
  if (after.w !== undefined) before.w = card.w;
  if (after.h !== undefined) before.h = card.h;
  if (after.shape !== undefined) before.shape = card.shape;
  if (after.color !== undefined) before.color = card.color;
  if (after.rotation !== undefined) before.rotation = card.rotation;
  if (after.fontSize !== undefined) before.fontSize = card.fontSize;
  if (after.content !== undefined) before.content = card.content;
  return before;
}
