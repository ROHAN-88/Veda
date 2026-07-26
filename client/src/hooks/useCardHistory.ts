import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { BulkCardUpdate } from '../api/cards';
import type { Card } from '../api/types';
import { inverseUpdate } from '../canvas/cardHistory';
import { useHistoryStore } from '../store/historyStore';
import { cardsKey, useBulkDeleteCards, useBulkRestoreCards, useBulkUpdateCards } from './useCards';

/**
 * Commit card group operations AND record their inverse on the undo stack
 * (Phase 8). Every edit that should be undoable (move / resize / rotate / recolor /
 * reshape / resize-text / delete) goes through here; content edits and
 * bring-to-front are intentionally excluded.
 */
export function useCardHistory(projectId: string) {
  const queryClient = useQueryClient();
  const { mutate: bulkUpdate } = useBulkUpdateCards(projectId);
  const { mutate: bulkDelete } = useBulkDeleteCards(projectId);
  const { mutate: bulkRestore } = useBulkRestoreCards(projectId);
  const push = useHistoryStore((state) => state.push);

  /** Apply `afters` and push an undo that restores the prior field values. */
  const commitUpdate = useCallback(
    (afters: BulkCardUpdate[]) => {
      if (afters.length === 0) {
        return;
      }
      const cards = queryClient.getQueryData<Card[]>(cardsKey(projectId)) ?? [];
      const byId = new Map(cards.map((card) => [card.id, card]));
      const befores = afters.flatMap((after) => {
        const card = byId.get(after.id);
        return card ? [inverseUpdate(card, after)] : [];
      });
      bulkUpdate(afters);
      push({ undo: () => bulkUpdate(befores), redo: () => bulkUpdate(afters) });
    },
    [queryClient, projectId, bulkUpdate, push],
  );

  /** Soft-delete `ids` and push an undo that restores them. */
  const commitDelete = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }
      bulkDelete(ids);
      push({ undo: () => bulkRestore(ids), redo: () => bulkDelete(ids) });
    },
    [bulkDelete, bulkRestore, push],
  );

  /** Record a just-created card so undo removes it (and redo restores it). */
  const pushCreate = useCallback(
    (id: string) => {
      push({ undo: () => bulkDelete([id]), redo: () => bulkRestore([id]) });
    },
    [bulkDelete, bulkRestore, push],
  );

  return { commitUpdate, commitDelete, pushCreate };
}
