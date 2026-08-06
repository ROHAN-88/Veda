import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../api/projects';
import type { Project } from '../api/types';
import { allNotesKey } from './useAllNotes';

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

/**
 * Show or hide a project in the combined notes view. Optimistic on the LIST key,
 * because the filter bar renders from `useProjects()` and a chip that lags behind
 * the click feels broken.
 */
export function useSetNotesIncluded() {
  const queryClient = useQueryClient();
  return useMutation<
    Project,
    Error,
    { id: string; notesIncluded: boolean },
    { previous?: Project[] }
  >({
    mutationFn: ({ id, notesIncluded }) => projectsApi.setNotesIncluded(id, notesIncluded),
    onMutate: async ({ id, notesIncluded }) => {
      const previous = queryClient.getQueryData<Project[]>(PROJECTS_KEY);
      if (previous) {
        queryClient.setQueryData<Project[]>(
          PROJECTS_KEY,
          previous.map((project) => (project.id === id ? { ...project, notesIncluded } : project)),
        );
      }
      await queryClient.cancelQueries({ queryKey: PROJECTS_KEY });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PROJECTS_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      // The combined list is server-filtered on this flag, so it is now stale.
      void queryClient.invalidateQueries({ queryKey: allNotesKey });
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
