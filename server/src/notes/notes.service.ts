import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Hard cap on a single combined read. Without it this is the one query in the app
 * whose size grows with the caller's whole account rather than with one board
 * (CWE-400). Mirrors `IMPORT_CARDS_MAX` in the transfer DTO. The client is told
 * when the cap was reached — a silently truncated list reads as "this is
 * everything" when it is not.
 */
export const NOTES_CARDS_MAX = 2000;

/**
 * The combined notes view: every card the caller owns, across all the projects
 * they have chosen to include.
 *
 * Authorization is the WHERE-CLAUSE, not a preceding check. `project: { ownerId }`
 * means a card belonging to someone else cannot be selected in the first place, so
 * there is no ownership assertion to forget and no 404-vs-403 decision to get
 * wrong (OWASP A01 / CWE-639). Same relation-filter idiom as
 * `CardsService.assertCardsOwned`.
 */
@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.card.findMany({
      where: {
        deletedAt: null,
        project: { ownerId: userId, notesIncluded: true },
      },
      // Determinism only — the client regroups and re-sorts each project into
      // reading order. `zIndex` is per-board, so it is meaningless as a global
      // key; leading with `projectId` keeps each board's cards contiguous.
      orderBy: [{ projectId: 'asc' }, { zIndex: 'asc' }],
      take: NOTES_CARDS_MAX,
    });
  }
}
