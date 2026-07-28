import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shareApi } from '../api/share';

const shareKey = (projectId: string) => ['share', projectId] as const;

/** Owner-facing sharing status. Enabled lazily so the project list doesn't fan
 *  out a status request per row — only when a share panel is opened. */
export function useShareStatus(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: shareKey(projectId),
    queryFn: () => shareApi.getStatus(projectId),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateShare(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => shareApi.create(projectId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: shareKey(projectId) }),
  });
}

export function useRevokeShare(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => shareApi.revoke(projectId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: shareKey(projectId) }),
  });
}
