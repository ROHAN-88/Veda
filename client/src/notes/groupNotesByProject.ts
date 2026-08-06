import type { Card, Project } from '../api/types';
import { sortCardsForReading } from './noteOrder';

/**
 * Cards from many boards, arranged for reading: grouped by project, each group in
 * the same reading order the single-board notes view uses. Pure — no DOM, no
 * React — so it is testable in the node environment.
 */
export interface NoteGroup {
  project: Project;
  cards: Card[];
}

/**
 * Bucket cards by project.
 *
 * Group order follows the `projects` array, which is the server's order
 * (`updatedAt desc`), so the most recently touched board leads. Within a group,
 * `sortCardsForReading` gives the same top-to-bottom, left-to-right order a
 * reader would take off the board itself.
 *
 * Two deliberate omissions:
 *  - **Empty groups are dropped**, so a board with no cards is not a bare heading.
 *  - **A card whose project is not in `projects` is dropped.** That only happens
 *    while the two queries are briefly out of step; a card with no attributable
 *    board is worse than a card that appears a moment later.
 */
export function groupNotesByProject(
  cards: readonly Card[],
  projects: readonly Project[],
): NoteGroup[] {
  const byProject = new Map<string, Card[]>();
  for (const card of cards) {
    const bucket = byProject.get(card.projectId);
    if (bucket) {
      bucket.push(card);
    } else {
      byProject.set(card.projectId, [card]);
    }
  }

  const groups: NoteGroup[] = [];
  for (const project of projects) {
    const bucket = byProject.get(project.id);
    if (bucket && bucket.length > 0) {
      groups.push({ project, cards: sortCardsForReading(bucket) });
    }
  }
  return groups;
}

/** Total cards across all groups — for the "showing N of M" paging line. */
export function countGroupedCards(groups: readonly NoteGroup[]): number {
  return groups.reduce((total, group) => total + group.cards.length, 0);
}
