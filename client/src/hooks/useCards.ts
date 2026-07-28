import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cardsApi,
  type BulkCardUpdate,
  type CreateCardInput,
  type UpdateCardInput,
} from '../api/cards';
import type { Card } from '../api/types';
import { nextZIndex } from '../canvas/cardGeometry';

export const cardsKey = (projectId: string) => ['cards', projectId] as const;
const connectionsKey = (projectId: string) => ['connections', projectId] as const;

/**
 * A project's cards. `enabled: false` (read-only share view) keeps the query from
 * hitting the owner-scoped endpoint — the caller pre-seeds the cache instead, so
 * an anonymous viewer renders from that seed without ever making an authed request.
 */
export function useCards(projectId: string, options?: { enabled?: boolean }) {
  return useQuery<Card[]>({
    queryKey: cardsKey(projectId),
    queryFn: () => cardsApi.list(projectId),
    enabled: projectId.length > 0 && (options?.enabled ?? true),
  });
}

export function useCreateCard(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCardInput) => cardsApi.create(projectId, input),
    // Create is discrete: the server assigns id + zIndex, so just refetch.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: cardsKey(projectId) }),
  });
}

interface UpdateVars {
  id: string;
  patch: UpdateCardInput;
}

/**
 * Optimistic card update (drag-move / bring-to-front / content edit) per ADR D10:
 * apply locally at once, roll back on error, reconcile with the server on settle.
 */
export function useUpdateCard(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<Card, Error, UpdateVars, { previous?: Card[] }>({
    mutationFn: ({ id, patch }) => cardsApi.patch(projectId, id, patch),
    onMutate: async ({ id, patch }) => {
      // Apply the optimistic update FIRST (synchronously), so a drag-end commit
      // batches with clearing the drag offset — no flicker. Then cancel in-flight
      // refetches so they can't clobber it.
      const previous = queryClient.getQueryData<Card[]>(cardsKey(projectId));
      if (previous) {
        queryClient.setQueryData<Card[]>(
          cardsKey(projectId),
          previous.map((card) => (card.id === id ? { ...card, ...patch } : card)),
        );
      }
      await queryClient.cancelQueries({ queryKey: cardsKey(projectId) });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cardsKey(projectId), context.previous);
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: cardsKey(projectId) }),
  });
}

/**
 * Raise a card to the top. The server allocates the authoritative `zIndex`
 * (max+1) — see the bring-to-front endpoint — so this can't be spoofed and two
 * tabs can't tie. We still apply an optimistic `nextZIndex(cache)` for instant
 * feel, then reconcile with the server's value on settle.
 */
export function useBringToFront(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<Card, Error, string, { previous?: Card[] }>({
    mutationFn: (id: string) => cardsApi.bringToFront(projectId, id),
    onMutate: async (id) => {
      const previous = queryClient.getQueryData<Card[]>(cardsKey(projectId));
      if (previous) {
        const top = nextZIndex(previous); // best-effort; server assigns the real value
        queryClient.setQueryData<Card[]>(
          cardsKey(projectId),
          previous.map((card) => (card.id === id ? { ...card, zIndex: top } : card)),
        );
      }
      await queryClient.cancelQueries({ queryKey: cardsKey(projectId) });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cardsKey(projectId), context.previous);
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: cardsKey(projectId) }),
  });
}

export function useDeleteCard(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string, { previous?: Card[] }>({
    mutationFn: (id: string) => cardsApi.remove(projectId, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: cardsKey(projectId) });
      const previous = queryClient.getQueryData<Card[]>(cardsKey(projectId));
      if (previous) {
        queryClient.setQueryData<Card[]>(
          cardsKey(projectId),
          previous.filter((card) => card.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cardsKey(projectId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: cardsKey(projectId) });
      // Deleting a card cascades its relation arrows server-side (Phase 5b) —
      // refetch connections so the removed arrows leave the UI too.
      void queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) });
    },
  });
}

/** Atomic multi-card update (group move / recolor / … and undo/redo). Optimistic. */
export function useBulkUpdateCards(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<Card[], Error, BulkCardUpdate[], { previous?: Card[] }>({
    mutationFn: (updates) => cardsApi.bulkUpdate(projectId, updates),
    onMutate: async (updates) => {
      const previous = queryClient.getQueryData<Card[]>(cardsKey(projectId));
      if (previous) {
        const patchById = new Map(updates.map(({ id, ...patch }) => [id, patch]));
        queryClient.setQueryData<Card[]>(
          cardsKey(projectId),
          previous.map((card) => {
            const patch = patchById.get(card.id);
            return patch ? { ...card, ...patch } : card;
          }),
        );
      }
      await queryClient.cancelQueries({ queryKey: cardsKey(projectId) });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cardsKey(projectId), context.previous);
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: cardsKey(projectId) }),
  });
}

/** Soft-delete many cards (group delete / undo of create). Optimistic. */
export function useBulkDeleteCards(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string[], { previous?: Card[] }>({
    mutationFn: (ids) => cardsApi.bulkDelete(projectId, ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: cardsKey(projectId) });
      const previous = queryClient.getQueryData<Card[]>(cardsKey(projectId));
      const idSet = new Set(ids);
      if (previous) {
        queryClient.setQueryData<Card[]>(
          cardsKey(projectId),
          previous.filter((card) => !idSet.has(card.id)),
        );
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) {
        queryClient.setQueryData(cardsKey(projectId), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: cardsKey(projectId) });
      void queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) });
    },
  });
}

/** Restore many soft-deleted cards (undo of delete). Restored rows + their arrows
 *  aren't in the cache, so just refetch both lists. */
export function useBulkRestoreCards(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string[]>({
    mutationFn: (ids) => cardsApi.bulkRestore(projectId, ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cardsKey(projectId) });
      void queryClient.invalidateQueries({ queryKey: connectionsKey(projectId) });
    },
  });
}
