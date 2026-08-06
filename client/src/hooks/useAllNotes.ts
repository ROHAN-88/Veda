import { useQuery } from '@tanstack/react-query';
import { notesApi } from '../api/notes';
import type { Card } from '../api/types';

export const allNotesKey = ['notes'] as const;

/**
 * Every card across the projects the user has opted into the combined view.
 *
 * Deliberately a SEPARATE cache entry from the per-board `['cards', projectId]`
 * keys: those carry the whiteboard's optimistic mutations, and merging the two
 * would let a drag on one board write into this list. Cross-board freshness comes
 * from the refetch-on-mount default instead.
 */
export function useAllNotes() {
  return useQuery<Card[]>({ queryKey: allNotesKey, queryFn: notesApi.list });
}
