import { apiFetch, apiJson } from './client';
import type { Project } from './types';

export const projectsApi = {
  list: (): Promise<Project[]> => apiFetch('/projects'),
  create: (name: string): Promise<Project> => apiJson('/projects', 'POST', { name }),
  rename: (id: string, name: string): Promise<Project> =>
    apiJson(`/projects/${id}`, 'PATCH', { name }),
  remove: (id: string): Promise<void> => apiJson(`/projects/${id}`, 'DELETE'),
};
