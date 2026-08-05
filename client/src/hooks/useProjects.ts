import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import type { Project } from '../api/types';

const PROJECTS_KEY = ['projects'];

export function useProjects() {
  return useQuery<Project[]>({ queryKey: PROJECTS_KEY, queryFn: projectsApi.list });
}

export function useProject(id: string | undefined) {
  return useQuery<Project>({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.get(id as string),
    enabled: id != null && id.length > 0,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => projectsApi.create(name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useRenameProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => projectsApi.rename(id, name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

/**
 * Set the notes-view background. Optimistic on `['projects', id]` — the key
 * `useProject` reads — so the surface repaints on click rather than after the
 * round trip; rolls back on error and reconciles on settle (ADR D10).
 */
export function useSetNotesBg(projectId: string) {
  const queryClient = useQueryClient();
  const key = ['projects', projectId];
  return useMutation<Project, Error, string, { previous?: Project }>({
    mutationFn: (notesBg: string) => projectsApi.setNotesBg(projectId, notesBg),
    onMutate: async (notesBg) => {
      const previous = queryClient.getQueryData<Project>(key);
      if (previous) {
        queryClient.setQueryData<Project>(key, { ...previous, notesBg });
      }
      await queryClient.cancelQueries({ queryKey: key });
      return { previous };
    },
    onError: (_err, _notesBg, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      // The list endpoint orders by updatedAt, which this PATCH bumps.
      void queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
