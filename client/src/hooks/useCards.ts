import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cardsApi, type CreateCardInput, type UpdateCardInput } from '../api/cards';
import type { Card } from '../api/types';

const cardsKey = (projectId: string) => ['cards', projectId] as const;

export function useCards(projectId: string) {
  return useQuery<Card[]>({
    queryKey: cardsKey(projectId),
    queryFn: () => cardsApi.list(projectId),
    enabled: projectId.length > 0,
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
    onSettled: () => void queryClient.invalidateQueries({ queryKey: cardsKey(projectId) }),
  });
}
