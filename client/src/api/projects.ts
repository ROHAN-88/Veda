import { apiFetch, apiJson } from './client';
import type { Project } from './types';

export const projectsApi = {
  list: (): Promise<Project[]> => apiFetch('/projects'),
  get: (id: string): Promise<Project> => apiFetch(`/projects/${encodeURIComponent(id)}`),
  create: (name: string): Promise<Project> => apiJson('/projects', 'POST', { name }),
  rename: (id: string, name: string): Promise<Project> =>
    apiJson(`/projects/${id}`, 'PATCH', { name }),
  /** Set the notes-view background; `''` clears it back to the theme default. */
  setNotesBg: (id: string, notesBg: string): Promise<Project> =>
    apiJson(`/projects/${id}`, 'PATCH', { notesBg }),
  /** Show or hide this project in the combined all-projects notes view. */
  setNotesIncluded: (id: string, notesIncluded: boolean): Promise<Project> =>
    apiJson(`/projects/${id}`, 'PATCH', { notesIncluded }),
  remove: (id: string): Promise<void> => apiJson(`/projects/${id}`, 'DELETE'),
};
