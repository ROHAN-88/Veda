import { apiFetch, apiJson } from './client';
import type { Card } from './types';

export interface CreateCardInput {
  x: number;
  y: number;
  w?: number;
  h?: number;
  content?: string;
  shape?: string;
  color?: string;
  rotation?: number;
  fontSize?: number;
}

export interface UpdateCardInput {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  content?: string;
  shape?: string;
  color?: string;
  rotation?: number;
  fontSize?: number;
  // `zIndex` is intentionally absent — stacking order is server-owned via
  // `bringToFront` (Phase 6); a client `zIndex` would be rejected (400).
}

/** One card in a bulk update: an id plus the fields to change. */
export type BulkCardUpdate = { id: string } & UpdateCardInput;

const base = (projectId: string): string => `/projects/${encodeURIComponent(projectId)}/cards`;

export const cardsApi = {
  list: (projectId: string): Promise<Card[]> => apiFetch(base(projectId)),
  create: (projectId: string, input: CreateCardInput): Promise<Card> =>
    apiJson(base(projectId), 'POST', input),
  patch: (projectId: string, id: string, input: UpdateCardInput): Promise<Card> =>
    apiJson(`${base(projectId)}/${encodeURIComponent(id)}`, 'PATCH', input),
  remove: (projectId: string, id: string): Promise<void> =>
    apiJson(`${base(projectId)}/${encodeURIComponent(id)}`, 'DELETE'),
  bringToFront: (projectId: string, id: string): Promise<Card> =>
    apiJson(`${base(projectId)}/${encodeURIComponent(id)}/bring-to-front`, 'POST'),
  // Phase 8 batch endpoints (group ops + undo/redo), each atomic on the server.
  bulkUpdate: (projectId: string, updates: BulkCardUpdate[]): Promise<Card[]> =>
    apiJson(base(projectId), 'PATCH', { updates }),
  bulkDelete: (projectId: string, ids: string[]): Promise<void> =>
    apiJson(`${base(projectId)}/bulk-delete`, 'POST', { ids }),
  bulkRestore: (projectId: string, ids: string[]): Promise<void> =>
    apiJson(`${base(projectId)}/bulk-restore`, 'POST', { ids }),
};
