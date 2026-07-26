import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Connection } from '../api/types';
import { useHistoryStore } from '../store/historyStore';
import {
  connectionsKey,
  useBulkDeleteConnections,
  useBulkRestoreConnections,
  useUpdateConnection,
} from './useConnections';

/**
 * Commit connection (arrow) ops AND record their inverse on the undo stack
 * (Phase 8) — delete, recolour, and create-then-undo all preserve the arrow's id
 * via the server's soft-delete/restore.
 */
export function useConnectionHistory(projectId: string) {
  const queryClient = useQueryClient();
  const { mutate: bulkDelete } = useBulkDeleteConnections(projectId);
  const { mutate: bulkRestore } = useBulkRestoreConnections(projectId);
  const { mutate: update } = useUpdateConnection(projectId);
  const push = useHistoryStore((state) => state.push);

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

  const commitRecolor = useCallback(
    (id: string, color: string) => {
      const before = queryClient
        .getQueryData<Connection[]>(connectionsKey(projectId))
        ?.find((conn) => conn.id === id)?.color;
      update({ id, patch: { color } });
      if (before) {
        push({
          undo: () => update({ id, patch: { color: before } }),
          redo: () => update({ id, patch: { color } }),
        });
      }
    },
    [queryClient, projectId, update, push],
  );

  /** Record a just-created arrow so undo removes it (and redo restores it). */
  const pushCreate = useCallback(
    (id: string) => {
      push({ undo: () => bulkDelete([id]), redo: () => bulkRestore([id]) });
    },
    [bulkDelete, bulkRestore, push],
  );

  return { commitDelete, commitRecolor, pushCreate };
}
