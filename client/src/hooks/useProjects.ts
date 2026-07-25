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

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
