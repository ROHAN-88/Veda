import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  connectionsApi,
  type CreateConnectionInput,
  type UpdateConnectionInput,
} from '../api/connections';
import type { Connection } from '../api/types';

/** React Query cache key for a project's connections. */
export const connectionsKey = (projectId: string) => ['connections', projectId] as const;

/**
 * A project's relation arrows. `enabled: false` (read-only share view) keeps the
 * query off the owner-scoped endpoint — the caller pre-seeds the cache instead.
 */
export function useConnections(projectId: string, options?: { enabled?: boolean }) {
  return useQuery<Connection[]>({
    queryKey: connectionsKey(projectId),
    queryFn: () => connectionsApi.list(projectId),
    enabled: projectId.length > 0 && (options?.enabled ?? true),
  });
}

export function useCreateConnection(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConnectionInput) => connectionsApi.create(projectId, input),
    // Create is discrete: the server assigns the id, so just refetch.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) }),
  });
}

interface UpdateVars {
  id: string;
  patch: UpdateConnectionInput;
}

/** Optimistic connection update (recolour) — mirrors {@link useUpdateCard} (ADR D10). */
export function useUpdateConnection(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<Connection, Error, UpdateVars, { previous?: Connection[] }>({
    mutationFn: ({ id, patch }) => connectionsApi.patch(projectId, id, patch),
    onMutate: async ({ id, patch }) => {
      const previous = queryClient.getQueryData<Connection[]>(connectionsKey(projectId));
      if (previous) {
        queryClient.setQueryData<Connection[]>(
          connectionsKey(projectId),
          previous.map((conn) => (conn.id === id ? { ...conn, ...patch } : conn)),
        );
      }
      await queryClient.cancelQueries({ queryKey: connectionsKey(projectId) });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(connectionsKey(projectId), context.previous);
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) }),
  });
}

export function useDeleteConnection(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string, { previous?: Connection[] }>({
    mutationFn: (id: string) => connectionsApi.remove(projectId, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: connectionsKey(projectId) });
      const previous = queryClient.getQueryData<Connection[]>(connectionsKey(projectId));
      if (previous) {
        queryClient.setQueryData<Connection[]>(
          connectionsKey(projectId),
          previous.filter((conn) => conn.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(connectionsKey(projectId), context.previous);
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) }),
  });
}

/** Soft-delete many arrows (undo of create). Optimistic. */
export function useBulkDeleteConnections(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string[], { previous?: Connection[] }>({
    mutationFn: (ids) => connectionsApi.bulkDelete(projectId, ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: connectionsKey(projectId) });
      const previous = queryClient.getQueryData<Connection[]>(connectionsKey(projectId));
      const idSet = new Set(ids);
      if (previous) {
        queryClient.setQueryData<Connection[]>(
          connectionsKey(projectId),
          previous.filter((conn) => !idSet.has(conn.id)),
        );
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(connectionsKey(projectId), context.previous);
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) }),
  });
}

/** Restore many soft-deleted arrows (undo of delete). Refetch (rows not in cache). */
export function useBulkRestoreConnections(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string[]>({
    mutationFn: (ids) => connectionsApi.bulkRestore(projectId, ids),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) }),
  });
}
