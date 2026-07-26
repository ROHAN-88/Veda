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
  zIndex?: number;
  shape?: string;
  color?: string;
  rotation?: number;
  fontSize?: number;
}

const base = (projectId: string): string => `/projects/${encodeURIComponent(projectId)}/cards`;

export const cardsApi = {
  list: (projectId: string): Promise<Card[]> => apiFetch(base(projectId)),
  create: (projectId: string, input: CreateCardInput): Promise<Card> =>
    apiJson(base(projectId), 'POST', input),
  patch: (projectId: string, id: string, input: UpdateCardInput): Promise<Card> =>
    apiJson(`${base(projectId)}/${encodeURIComponent(id)}`, 'PATCH', input),
  remove: (projectId: string, id: string): Promise<void> =>
    apiJson(`${base(projectId)}/${encodeURIComponent(id)}`, 'DELETE'),
};
