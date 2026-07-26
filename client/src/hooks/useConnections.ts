import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  connectionsApi,
  type CreateConnectionInput,
  type UpdateConnectionInput,
} from '../api/connections';
import type { Connection } from '../api/types';

/** React Query cache key for a project's connections. */
export const connectionsKey = (projectId: string) => ['connections', projectId] as const;

export function useConnections(projectId: string) {
  return useQuery<Connection[]>({
    queryKey: connectionsKey(projectId),
    queryFn: () => connectionsApi.list(projectId),
    enabled: projectId.length > 0,
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
