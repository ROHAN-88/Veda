import { apiFetch, apiJson } from './client';
import type { Connection } from './types';

export interface CreateConnectionInput {
  sourceCardId: string;
  targetCardId: string;
  color?: string;
}

export interface UpdateConnectionInput {
  color?: string;
}

const base = (projectId: string): string =>
  `/projects/${encodeURIComponent(projectId)}/connections`;

export const connectionsApi = {
  list: (projectId: string): Promise<Connection[]> => apiFetch(base(projectId)),
  create: (projectId: string, input: CreateConnectionInput): Promise<Connection> =>
    apiJson(base(projectId), 'POST', input),
  patch: (projectId: string, id: string, input: UpdateConnectionInput): Promise<Connection> =>
    apiJson(`${base(projectId)}/${encodeURIComponent(id)}`, 'PATCH', input),
  remove: (projectId: string, id: string): Promise<void> =>
    apiJson(`${base(projectId)}/${encodeURIComponent(id)}`, 'DELETE'),
  // Phase 8: soft-delete / restore for undo/redo of arrow ops.
  bulkDelete: (projectId: string, ids: string[]): Promise<void> =>
    apiJson(`${base(projectId)}/bulk-delete`, 'POST', { ids }),
  bulkRestore: (projectId: string, ids: string[]): Promise<void> =>
    apiJson(`${base(projectId)}/bulk-restore`, 'POST', { ids }),
};
